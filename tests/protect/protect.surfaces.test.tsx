// MP-30 AC5-AC9, AC13: what the renter sees with the flag off. Review & Request shows no switch,
// line or copy; the snapshot surfaces drop Protect unless the booking already carries a Protect
// charge (then they show it, reconciled); the storefront drops both Protect lines; no renter-flow
// surface renders a Protect word; and the in-flight freeze still holds for every remaining control.
// Rendered with react-dom/server against the base goldens in ./golden. Red on the base by design.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ confirmation: null as unknown, dropAbout: false, cancelProps: [] as Record<string, unknown>[] }));
vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('notFound'); },
}));
// The confirmation reads its booking through the service; every mock team has an `about`, so the
// no-about storefront wraps the real storefront and drops it.
vi.mock('@/domain/booking/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/booking/service')>();
  return {
    ...actual,
    getBookingConfirmation: async (ref: string, token?: string) =>
      (svc.confirmation as Awaited<ReturnType<typeof actual.getBookingConfirmation>> | null) ?? actual.getBookingConfirmation(ref, token),
    getPublicTeamStorefront: async (slug: string) => {
      const s = await actual.getPublicTeamStorefront(slug);
      return s && svc.dropAbout ? { ...s, team: { ...s.team, about: undefined } } : s;
    },
  };
});
// Records the cancel card's props and renders the real card, so the markup is unchanged.
vi.mock('@/components/drive-exotiq/CancelBookingCard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/drive-exotiq/CancelBookingCard')>();
  const { createElement: h } = await import('react');
  return { ...actual, CancelBookingCard: (props: Parameters<typeof actual.CancelBookingCard>[0]) => { svc.cancelProps.push(props as unknown as Record<string, unknown>); return h(actual.CancelBookingCard, props); } };
});

import TeamStorefrontRoute from '@/app/[operatorSlug]/page';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { PaymentCard } from '@/components/drive-exotiq/PaymentCard';
import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { createInitialCart } from '@/domain/booking/mockData';
import type { PublicBookingConfirmation } from '@/domain/booking/publicContracts';
import { CONSENT_TEXT } from '@/domain/renters/consentText';
import { stripComments } from '../design/lib/scan.mjs';
import { between, literals, sliceFunction } from '../restraint/restraintScan';
import { ACCESS_TOKEN, BOOKING_REF, type Case, type El, NOW_ISO, OPERATOR, OPERATOR_NAME, VEHICLE, byAttr, classes, confirmationOf, contains, elements, fixture, norm, outer, parseHtml, parseMoney, paymentPropsOf, quoteOf, reviewCartOf, textOf } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const noop = () => {};
const BASE_ENV: Record<string, string> = { NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE: 'mock', NEXT_PUBLIC_RENTER_CAPTURE: 'on', NEXT_PUBLIC_MARKETPLACE_BROWSE: 'off', NEXT_PUBLIC_SITE_MODE: 'booking' };
/** One case's environment, whatever the ambient env says: the harness values, then the flag (undefined = unset). */
function env(flag: string | undefined, extra: Record<string, string> = {}): void {
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...extra })) vi.stubEnv(k, v);
  vi.stubEnv('NEXT_PUBLIC_PROTECT_ENABLED', flag);
}
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW_ISO)); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); svc.confirmation = null; svc.dropAbout = false; svc.cancelProps.length = 0; });
afterAll(() => { vi.useRealTimers(); });

// ReviewStep's props are read loosely, as MP-26 does, so the base and the change both compile.
const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;
/** Review & Request with a fixture's quote, or the mock cart with no quote (c = null). */
const review = (c: Case | null, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(Review, { cart: c ? reviewCartOf(c) : createInitialCart({ operator: OPERATOR, vehicle: VEHICLE }), goTo: noop, onRequest: noop, quote: c ? quoteOf(c) : undefined, onProtectionChange: noop, onMarketingConsentChange: noop, ...extra }));
const payment = (c: Case) => renderToStaticMarkup(createElement(PaymentCard, paymentPropsOf(c)));
/** The requested state: the paid snapshot with status requested and no payment fields. */
function requestedOf(c: Case): PublicBookingConfirmation {
  const b = confirmationOf(c, 'paid');
  return { ...b, live: { ...b.live!, status: 'requested', paidAt: undefined, paymentDueAt: undefined } };
}
async function confirmation(kind: 'paid' | 'requested' | 'mock', c?: Case): Promise<string> {
  svc.confirmation = kind === 'mock' ? { bookingRef: 'BK-01001', team: OPERATOR, vehicle: VEHICLE } : kind === 'paid' ? confirmationOf(c!, 'paid') : requestedOf(c!);
  return renderToStaticMarkup(await ConfirmationScreen(kind === 'mock' ? { bookingRef: 'BK-01001' } : { bookingRef: BOOKING_REF, accessToken: ACCESS_TOKEN }));
}
async function storefront(withAbout: boolean): Promise<string> {
  svc.dropAbout = !withAbout;
  return renderToStaticMarkup(await TeamStorefrontRoute({ params: Promise.resolve({ operatorSlug: OPERATOR.slug }), searchParams: Promise.resolve({}) }));
}
const flow = () => renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE }));

const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url));
const golden = (name: string) => readFileSync(join(GOLDEN_DIR, name), 'utf8');
type Notice = (a: { free: boolean; paid: boolean; protection: boolean }) => string;
// Read loosely: the module is mocked above, and vitest throws on an export the mock does not have.
const notice = async (): Promise<Notice | undefined> => { try { return ((await import('@/components/drive-exotiq/CancelBookingCard')) as { cancelNotice?: Notice }).cancelNotice; } catch { return undefined; } };

const P0 = fixture('FX-T1S1P0');
const P1 = fixture('FX-T1S1P1');
const QUOTE_MESSAGE = "We couldn't confirm final pricing. Please try again.";
const DECLINED = ['FX-T0S0P0', 'FX-T0S1P0', 'FX-T1S0P0', 'FX-T1S1P0'] as const;
const WORD = /protect|coverage|waiver/gi;
/** AC9: every match in the text and the attribute values; script, style and template contents skipped (their attributes still read). */
function censusHits(html: string): string[] {
  const hits: string[] = [];
  const visit = (el: El) => {
    for (const [k, v] of Object.entries(el.attrs)) for (const m of Array.from(v.matchAll(WORD))) hits.push(`@${k}: ${m[0]} in "${v}"`);
    if (['script', 'style', 'template'].includes(el.tag)) return;
    for (const c of el.children) {
      if (typeof c === 'string') { for (const m of Array.from(c.matchAll(WORD))) hits.push(`text: ${m[0]} in "${norm(c).slice(0, 120)}"`); }
      else visit(c);
    }
  };
  visit(parseHtml(html));
  return hits;
}
const switchesIn = (html: string) => elements(parseHtml(html)).filter((e) => e.attrs.role === 'switch' && e.attrs['aria-label'] === 'Exotiq Protect');
const textBy = (html: string, tag: string, starts: string) => elements(parseHtml(html)).filter((e) => e.tag === tag && norm(textOf(e)).startsWith(starts)).map((e) => norm(textOf(e)));
/** AC5: the declined golden with exactly the three edits (each must occur exactly once). */
function threeEdits(g: string): string {
  const sw = elements(parseHtml(g)).find((e) => e.attrs.role === 'switch' && e.attrs['aria-label'] === 'Exotiq Protect');
  let block: El | null | undefined = sw;
  while (block && !(block.tag === 'div' && classes(block).join(' ') === 'mt-4 border-t border-line pt-4')) block = block.parent;
  if (!block) throw new Error('switch block not found in the golden');
  const once = (s: string, a: string, b: string) => { if (s.split(a).length !== 2) throw new Error(`"${a}" is not in the golden exactly once`); return s.replace(a, b); };
  return once(once(g.slice(0, block.start) + g.slice(block.end), ' and protection', ''), 'Cancellation &amp; coverage', 'Cancellation policy');
}
const WHY_OFF = ['Operator-owned rental charge stays clear.', 'Documents are verified before pickup.', 'Concierge handoff details are coordinated before arrival.'];
const OLD_ABOUT = 'A concierge-approved fleet with mobile-first booking, verified drivers, transparent rental charges, and optional Exotiq Protect shown separately.';
const NEW_ABOUT = 'A concierge-approved fleet with mobile-first booking, verified drivers, and transparent rental charges.';
/** AC8: each "Why renters book here" card's items, in order (two copies: phone and desktop). */
const whyLists = (html: string) => elements(parseHtml(html))
  .filter((e) => e.tag === 'div' && e.children.some((c) => typeof c !== 'string' && norm(textOf(c)) === 'Why renters book here'))
  .map((card) => card.children.filter((c): c is El => typeof c !== 'string').slice(1).map((c) => norm(textOf(c))));
function withoutWhyItem(g: string): string {
  const els = elements(parseHtml(g)).filter((e) => e.tag === 'div' && norm(textOf(e)) === 'Exotiq Protect is shown separately.' && e.children.every((c) => typeof c === 'string'));
  if (els.length !== 2) throw new Error(`${els.length} Protect Why items in the golden, expected 2`);
  return els.sort((a, b) => b.start - a.start).reduce((s, e) => s.slice(0, e.start) + s.slice(e.end), g);
}
/** AC8: both Why cards list exactly the three flag-off items, in order. */
function whyProblems(html: string): string[] {
  const lists = whyLists(html);
  if (lists.length !== 2) return [`${lists.length} Why cards, expected 2 (phone and desktop)`];
  return lists.flatMap((l, i) => (JSON.stringify(l) === JSON.stringify(WHY_OFF) ? [] : [`Why card ${i + 1}: ${JSON.stringify(l)}`]));
}
/** AC13: the label holding `text` and its input. */
function labelInput(root: El, text: string): { label?: El; input?: El } {
  const label = elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === text);
  return { label, input: label ? elements(label).find((e) => e.tag === 'input') : undefined };
}
/** AC13: what a request in flight must freeze, with the flag off (no switch to freeze). */
function frozenProblems(idleHtml: string, flightHtml: string): string[] {
  const p: string[] = []; const idle = parseHtml(idleHtml); const flight = parseHtml(flightHtml);
  if (switchesIn(flightHtml).length) p.push('flight: a Protect switch renders');
  const fOpt = labelInput(flight, CONSENT_TEXT.booking.text); const iOpt = labelInput(idle, CONSENT_TEXT.booking.text);
  if (!fOpt.input || !('disabled' in fOpt.input.attrs)) p.push('flight: the opt-in is not disabled');
  if (!iOpt.input || 'disabled' in iOpt.input.attrs) p.push('idle: the opt-in is disabled or missing');
  const fRental = byAttr(flight, 'data-money-line', 'rental')[0];
  if (!fRental || fRental.tag === 'button' || elements(fRental).some((e) => e.tag === 'button' && !('disabled' in e.attrs))) p.push('flight: the rental row is an enabled button');
  const iRental = byAttr(idle, 'data-money-line', 'rental')[0];
  if (!iRental || iRental.tag !== 'button' || 'disabled' in iRental.attrs) p.push('idle: the rental row is not the enabled button');
  const busy = elements(flight).filter((e) => e.attrs['aria-busy'] === 'true');
  const card = byAttr(flight, 'data-money', 'card')[0];
  if (busy.length !== 1 || !card || !fOpt.label || !contains(busy[0], card) || !contains(busy[0], fOpt.label)) p.push(`flight: aria-busy wrapper (${busy.length}) does not hold the card and the opt-in`);
  if (elements(idle).some((e) => e.attrs['aria-busy'] === 'true')) p.push('idle: aria-busy="true" present');
  const terms = elements(flight).find((e) => e.attrs.id === 'review-terms');
  if (!terms || 'disabled' in terms.attrs) p.push('flight: the terms checkbox is disabled or missing');
  const cta = elements(flight).find((e) => e.tag === 'button' && norm(textOf(e)) === 'Sending request…');
  if (!cta || !('disabled' in cta.attrs)) p.push('flight: no inert "Sending request…" button');
  return p;
}

// ---- reading the money card (as MP-26 reads it) ----------------------------------------------------
const inDetail = (el: El) => { for (let n: El | null = el.parent; n; n = n.parent) if (n.attrs['data-money'] === 'trip-fees-detail') return true; return false; };
const rowsOf = (group: El): El[] => byAttr(group, 'data-money-line').filter((r) => !inDetail(r));
function amountOf(row: El): number | undefined {
  const fig = elements(row).find((e) => e !== row && classes(e).includes('tabular-nums') && !inDetail(e));
  return fig ? parseMoney(textOf(fig)) : undefined;
}
/** AC7: each group's lines sum to its subtotal row (residual 0). */
function residualProblems(label: string, html: string): string[] {
  const root = parseHtml(html);
  const p: string[] = [];
  for (const name of ['group-operator', 'group-exotiq']) {
    const group = byAttr(root, 'data-money', name)[0];
    if (!group) { p.push(`${label}: no ${name}`); continue; }
    const rows = rowsOf(group);
    const sum = rows.filter((r) => r.attrs['data-money-line'] !== 'subtotal').reduce((a, r) => a + (amountOf(r) ?? 0), 0);
    const sub = rows.find((r) => r.attrs['data-money-line'] === 'subtotal');
    const subtotal = sub ? amountOf(sub) : undefined;
    if (sum !== subtotal) p.push(`${label}: ${name} lines sum ${sum}, subtotal ${subtotal} (residual ${(subtotal ?? 0) - sum})`);
  }
  return p;
}
/** AC5: the Drive Exotiq group's row keys (the Trip-fees detail rows and the subtotal excluded). */
const exotiqKeys = (html: string) => { const g = byAttr(parseHtml(html), 'data-money', 'group-exotiq')[0]; return g ? rowsOf(g).map((r) => r.attrs['data-money-line']).filter((k) => k !== 'subtotal') : []; };
const STATEMENT_OFF = "Two charges on your statement: the operator's rental, and an EXOTIQ RENT charge covering Trip fees, the state rental fee and card processing. One card entry.";
const statementProblems = (label: string, html: string): string[] => {
  const got = textBy(html, 'p', 'Two charges on your statement');
  return JSON.stringify(got) === JSON.stringify([STATEMENT_OFF]) ? [] : [`${label}: statement ${JSON.stringify(got)}`];
};

describe('MP-30 surfaces with the flag off', () => {
  it('Review and Request shows no Protect switch, line or copy with the flag off', () => {
    env(undefined);
    const problems: string[] = [];
    const cases: [string, string][] = [
      ...DECLINED.map((id): [string, string] => [id, review(fixture(id))]),
      ['mock', review(null)],
      // A stale premium cart (the tier before the flip) with a declined quote: still nothing.
      ['stale premium cart', renderToStaticMarkup(createElement(Review, { cart: reviewCartOf(P1), goTo: noop, onRequest: noop, quote: quoteOf(P0), onProtectionChange: noop, onMarketingConsentChange: noop }))],
    ];
    for (const [label, html] of cases) {
      if (switchesIn(html).length) problems.push(`${label}: a Protect switch renders`);
      if (byAttr(parseHtml(html), 'data-money-line', 'protect').length) problems.push(`${label}: a Protect money line renders`);
      if (html.includes('Premium coverage')) problems.push(`${label}: "Premium coverage"`);
      if (html.includes('Exotiq Protect covers damage')) problems.push(`${label}: the cover paragraph`);
      const statement = textBy(html, 'p', 'Two charges:');
      if (JSON.stringify(statement) !== JSON.stringify([`Two charges: ${OPERATOR_NAME}, and EXOTIQ RENT for Trip fees.`])) problems.push(`${label}: statement ${JSON.stringify(statement)}`);
      const summary = textBy(html, 'summary', 'Cancellation');
      if (JSON.stringify(summary) !== JSON.stringify(['Cancellation policy'])) problems.push(`${label}: summary ${JSON.stringify(summary)}`);
    }
    // The declined fixture is its base golden with exactly the three edits.
    if (review(P0) !== threeEdits(golden('review-FX-T1S1P0.html'))) problems.push('FX-T1S1P0: the markup is not the base golden with exactly the three edits');
    // Mock mode: the Drive Exotiq group is Trip fees only.
    const keys = exotiqKeys(review(null));
    if (JSON.stringify(keys) !== JSON.stringify(['trip-fees'])) problems.push(`mock: Drive Exotiq rows ${JSON.stringify(keys)}`);

    // Planted: the base premium render has the switch; a render without the switch block cannot pass as edited.
    expect(switchesIn(golden('review-FX-T1S1P1.html'))).toHaveLength(1);
    expect(() => threeEdits('<div class="mt-4 border-t border-line pt-4"><p>no switch</p></div>')).toThrow('switch block not found');

    expect(problems).toEqual([]);
  });

  it('payment link, receipts, confirmation and cancel copy drop Protect with the flag off', async () => {
    env(undefined);
    const problems: string[] = [];
    for (const id of DECLINED) problems.push(...statementProblems(`payment ${id}`, payment(fixture(id))));
    // PaymentCard keeps MP-26's eleven props (tests/fees/fees.surfaces.test.tsx:762-763).
    const pc = stripComments(read('components/drive-exotiq/PaymentCard.tsx'));
    const params = /export function PaymentCard\(\{([\s\S]*?)\}: \{/.exec(pc)?.[1].split(',').map((x) => x.trim()).filter(Boolean);
    if (JSON.stringify(params) !== JSON.stringify(['bookingRef', 'accessToken', 'dueAtIso', 'rentalCents', 'platformFeeCents', 'protectionTotalCents', 'stateFeeCents = 0', 'processingFeeCents = 0', 'operatorTaxCents = 0', 'operatorTaxLabel', 'operatorName'])) problems.push(`PaymentCard props ${JSON.stringify(params)}`);

    const requested = await confirmation('requested', P0);
    if (!elements(parseHtml(requested)).some((e) => e.tag === 'p' && norm(textOf(e)) === 'Trip fees are itemized at payment, once the operator approves.')) problems.push('requested: no "Trip fees are itemized at payment, once the operator approves."');
    if (requested.includes('Trip fees and protection')) problems.push('requested: still "Trip fees and protection"');
    if (svc.cancelProps.at(-1)?.protectionCharged !== false) problems.push(`requested: CancelBookingCard protectionCharged ${String(svc.cancelProps.at(-1)?.protectionCharged)}`);
    if (byAttr(parseHtml(await confirmation('mock')), 'data-money-line', 'protect').length) problems.push('mock confirmation: a Protect row in Charges');

    const cancelNotice = await notice();
    if (!cancelNotice) problems.push('cancelNotice is not exported');
    else {
      const S = JSON.parse(golden('cancel-sentences.json')) as string[];
      const want: [boolean, boolean, string][] = [
        [true, true, S[0]],
        [true, false, S[1]],
        [false, false, S[3]],
        [false, true, 'The 72-hour window has passed: the rental and Trip Fees are non-refundable. Cancelling releases the dates without a refund.'],
      ];
      for (const [free, paid, sentence] of want) {
        const got = cancelNotice({ free, paid, protection: false });
        if (got !== sentence) problems.push(`cancelNotice(free ${free}, paid ${paid}, protection false): ${JSON.stringify(got)}`);
      }
    }

    // Planted: a statement that still names protection is reported by the same comparator.
    expect(statementProblems('planted', golden('payment-FX-T1S1P0.html'))).not.toEqual([]);

    expect(problems).toEqual([]);
  });

  it('a booking that already carries a Protect charge still shows it, reconciled', async () => {
    env(undefined);
    const problems: string[] = [];
    const pay = payment(P1);
    if (pay !== golden('payment-FX-T1S1P1.html')) problems.push('payment FX-T1S1P1: differs from the base golden');
    const paid = await confirmation('paid', P1);
    if (paid !== golden('paid-FX-T1S1P1.html')) problems.push('paid FX-T1S1P1: differs from the base golden');
    if (svc.cancelProps.at(-1)?.protectionCharged !== true) problems.push(`paid: CancelBookingCard protectionCharged ${String(svc.cancelProps.at(-1)?.protectionCharged)}`);
    const requested = await confirmation('requested', P1);
    if (requested !== golden('requested-FX-T1S1P1.html')) problems.push('requested FX-T1S1P1: differs from the base golden');
    if (svc.cancelProps.at(-1)?.protectionCharged !== true) problems.push(`requested: CancelBookingCard protectionCharged ${String(svc.cancelProps.at(-1)?.protectionCharged)}`);
    const cancelNotice = await notice();
    if (!cancelNotice) problems.push('cancelNotice is not exported');
    else if (cancelNotice({ free: false, paid: true, protection: true }) !== golden('cancel-paid-forfeit.txt')) problems.push('cancelNotice(forfeit, paid, protection): not the base sentence');
    problems.push(...residualProblems('payment FX-T1S1P1', pay), ...residualProblems('paid FX-T1S1P1', paid));

    // Planted: cutting the Protect row out of the paid render leaves a residual.
    const row = byAttr(parseHtml(paid), 'data-money-line', 'protect')[0];
    expect(row, 'the paid render has a Protect row').toBeDefined();
    expect(residualProblems('planted', paid.slice(0, row.start) + paid.slice(row.end))).not.toEqual([]);

    expect(problems).toEqual([]);
  });

  it('the storefront drops both Protect lines with the flag off', async () => {
    env(undefined);
    const problems: string[] = [];
    const about = OPERATOR.about!;
    const withAbout = await storefront(true);
    problems.push(...whyProblems(withAbout).map((p) => `about: ${p}`));
    const aboutPs = elements(parseHtml(withAbout)).filter((e) => e.tag === 'p' && textOf(e) === about).length;
    if (aboutPs !== 2) problems.push(`about: ${aboutPs} <p> read the team's own about, expected 2`);
    if (withAbout.includes(OLD_ABOUT) || withAbout.includes(NEW_ABOUT)) problems.push('about: a fallback About sentence renders for a team with its own');
    if (withAbout !== withoutWhyItem(golden('storefront-about.html'))) problems.push('about: not the base golden minus the two Why items');

    const noAbout = await storefront(false);
    problems.push(...whyProblems(noAbout).map((p) => `no about: ${p}`));
    const newPs = elements(parseHtml(noAbout)).filter((e) => e.tag === 'p' && textOf(e) === NEW_ABOUT).length;
    if (newPs !== 2) problems.push(`no about: ${newPs} <p> read the flag-off About, expected 2`);
    if (noAbout.includes(OLD_ABOUT)) problems.push('no about: the old About fallback renders');
    const g = golden('storefront-no-about.html');
    if (g.split(OLD_ABOUT).length !== 3) problems.push(`the no-about golden holds the old About ${g.split(OLD_ABOUT).length - 1} times, expected 2`);
    if (noAbout !== withoutWhyItem(g).split(OLD_ABOUT).join(NEW_ABOUT)) problems.push('no about: not the base golden minus the Why items with the one sentence change');

    env('true');
    if ((await storefront(true)) !== golden('storefront-about.html')) problems.push('flag true: the about storefront differs from the base');
    if ((await storefront(false)) !== g) problems.push('flag true: the no-about storefront differs from the base');

    // Planted: a fourth item in both cards, and the Protect item left in only one copy, are reported.
    const base = golden('storefront-about.html');
    expect(whyProblems(base)).toHaveLength(2);
    const item = elements(parseHtml(base)).filter((e) => e.tag === 'div' && norm(textOf(e)) === 'Exotiq Protect is shown separately.' && e.children.every((c) => typeof c === 'string'))[0];
    expect(whyProblems(base.slice(0, item.start) + base.slice(item.end))).toHaveLength(1);

    expect(problems).toEqual([]);
  });

  it('no renter-flow surface renders a Protect word with the flag off', async () => {
    env(undefined);
    const surfaces: [string, string][] = [
      ['storefront (about)', await storefront(true)],
      ['storefront (no about)', await storefront(false)],
      ['vehicle page', renderToStaticMarkup(await VehicleEntryPage({ operatorSlug: OPERATOR.slug, vehicleSlug: VEHICLE.slug }))],
      ['BookingFlow first render', flow()],
      ['DriverStep', renderToStaticMarkup(createElement(DriverStep, { cart: createInitialCart({ operator: OPERATOR, vehicle: VEHICLE }), setCart: noop, next: noop }))],
      ...DECLINED.map((id): [string, string] => [`review ${id}`, review(fixture(id))]),
      ['review mock', review(null)],
      ['review requesting', review(P0, { requesting: true })],
      ['review blocked pending', review(P0, { blocked: true, quotePending: true })],
      ['review blocked failed', review(P0, { blocked: true, quoteError: QUOTE_MESSAGE, onRetryQuote: noop })],
      ...DECLINED.map((id): [string, string] => [`payment ${id}`, payment(fixture(id))]),
      ['paid FX-T1S1P0', await confirmation('paid', P0)],
      ['requested FX-T1S1P0', await confirmation('requested', P0)],
      ['mock confirmation', await confirmation('mock')],
    ];
    const cancelNotice = await notice();
    const problems: string[] = [];
    if (!cancelNotice) problems.push('cancelNotice is not exported');
    else for (const [free, paid] of [[true, true], [true, false], [false, true], [false, false]]) surfaces.push([`cancelNotice(free ${free}, paid ${paid})`, cancelNotice({ free, paid, protection: false })]);
    for (const [label, html] of surfaces) for (const h of censusHits(html)) problems.push(`${label}: ${h}`);
    if (cancelNotice && surfaces.length !== 24) problems.push(`${surfaces.length} surfaces, expected 24`);

    // Planted: an aria-label, a data attribute and a CSS-hidden copy count; script, style and template contents do not.
    expect(censusHits('<div aria-label="Exotiq Protect"></div><span data-x="protect"></span><div class="hidden lg:block">coverage</div><script>self.__next_f.push({"protectionTotalCents":0})</script><style>.protect{}</style><template><p>waiver</p></template>')).toHaveLength(3);
    env('true');
    expect(censusHits(await storefront(true)).length).toBeGreaterThan(0);

    expect(problems).toEqual([]);
  });

  it('with the flag off the request still freezes the controls that remain', () => {
    env(undefined);
    const idle = review(P0);
    const flight = review(P0, { requesting: true });
    const problems = frozenProblems(idle, flight);
    // Planted: an idle render passed off as in flight is caught on each frozen control.
    const planted = frozenProblems(idle, idle).join('\n');
    for (const word of ['opt-in', 'rental', 'aria-busy', 'Sending request']) expect(planted).toContain(word);
    expect(problems).toEqual([]);
  });
});
