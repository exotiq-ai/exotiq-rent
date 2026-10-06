// MP-26 AC2-AC6, AC9, AC13, AC14, AC16: the two-party money card on the four money surfaces.
// Surfaces: Review & Request (ReviewStep), the payment link (PaymentCard), the paid receipt
// (ConfirmationScreen with live.paidAt) and the mock charges block (ConfirmationScreen without
// live). Each is rendered with react-dom/server from the source shape it really holds (the quote,
// the PaymentCard props, `live`, the mock cart), and every check is a named function that also
// runs on planted markup, so a red run names the surface and the fixture.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fragment, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ confirmation: null as unknown, cart: null as unknown }));
vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));
// The confirmation reads its booking through the service; the mock "Charges" block builds its own
// cart (always Protect ON), so the OFF fixture overrides createBookingCart (locate sharpening 5).
vi.mock('@/domain/booking/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/booking/service')>();
  return {
    ...actual,
    getBookingConfirmation: async () => svc.confirmation,
    createBookingCart: (o: Parameters<typeof actual.createBookingCart>[0]) => (svc.cart as ReturnType<typeof actual.createBookingCart> | null) ?? actual.createBookingCart(o),
  };
});

import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { PaymentCard } from '@/components/drive-exotiq/PaymentCard';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { CONSENT_TEXT } from '@/domain/renters/consentText';
import { stripComments } from '../design/lib/scan.mjs';
import { goldCount, isBox, literals, prepare } from '../restraint/restraintScan';
import {
  ACCESS_TOKEN,
  BOOKING_REF,
  type Case,
  type El,
  EXOTIQ_HEADER,
  NOW_ISO,
  OLD_STRINGS,
  OPERATOR,
  OPERATOR_HEADER,
  OPERATOR_NAME,
  VEHICLE,
  assertCanary,
  byAttr,
  byId,
  classes,
  confirmationOf,
  contains,
  elements,
  expected,
  fixture,
  fixtures,
  foldInputOf,
  liveOf,
  makeCase,
  mockCase,
  moneyText,
  norm,
  orderOf,
  outer,
  parseHtml,
  parseMoney,
  paymentPropsOf,
  quoteOf,
  reviewCartOf,
  sample64,
  textOf,
} from './fixtures';
import { REPO, readGolden, switchBlock, switchBlockEl } from './goldens';

const EVIDENCE = process.env.MP26_EVIDENCE_DIR ?? '';
const BASE = process.env.MP26_BASE_REF ?? '';
const noop = () => {};
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const FEECARD = 'components/drive-exotiq/FeeCard.tsx';
const FEEGROUPS = 'components/drive-exotiq/feeGroups.ts';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
const PAYCARD = 'components/drive-exotiq/PaymentCard.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
// ReviewStep's props change in this ticket: a loose type keeps the base and the change compiling.
const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;

type Card = typeof import('@/components/drive-exotiq/FeeCard');
type Fold = typeof import('@/components/drive-exotiq/feeGroups');
async function card(): Promise<Card | null> { try { return await import('@/components/drive-exotiq/FeeCard'); } catch { return null; } }
async function fold(): Promise<Fold | null> { try { return await import('@/components/drive-exotiq/feeGroups'); } catch { return null; } }

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
  vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
});
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
  svc.confirmation = null;
  svc.cart = null;
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ---- the four surfaces ----------------------------------------------------------------------------

type Surface = 'review' | 'payment' | 'paid' | 'mock';
const SURFACES: Surface[] = ['review', 'payment', 'paid', 'mock'];
const NAME: Record<Surface, string> = { review: 'Review & Request', payment: 'payment link', paid: 'paid receipt', mock: 'mock charges' };

/** The mock block can show only what its cart holds (tax 0, no state fee, no processing). */
const mockShape = (c: Case): Case => makeCase({ id: `${c.id}~mock`, days: c.days, dailyRateCents: c.dailyRateCents, taxPct: 0, stateDaily: 0, processingFeeCents: 0, protect: c.protect });
/** The cases a surface is checked on: the eight fixtures (the mock surface has its own two). */
const casesFor = (s: Surface): Case[] => (s === 'mock' ? [mockCase(true), mockCase(false)] : fixtures());

async function render(s: Surface, c: Case, extra: Record<string, unknown> = {}): Promise<string> {
  if (s === 'review') return renderToStaticMarkup(<Review cart={reviewCartOf(c)} goTo={noop} onRequest={noop} quote={quoteOf(c)} onProtectionChange={noop} onMarketingConsentChange={noop} {...extra} />);
  if (s === 'payment') return renderToStaticMarkup(<PaymentCard {...paymentPropsOf(c)} {...extra} />);
  if (s === 'paid') {
    svc.confirmation = confirmationOf(c, 'paid');
    svc.cart = null;
    return renderToStaticMarkup(await ConfirmationScreen({ bookingRef: BOOKING_REF, accessToken: ACCESS_TOKEN }));
  }
  svc.confirmation = { bookingRef: 'BK-01001', team: OPERATOR, vehicle: VEHICLE };
  // MOCK-P1 is the page's own default cart (premium); everything else overrides it.
  svc.cart = c.id === 'MOCK-P1' ? null : reviewCartOf(c);
  return renderToStaticMarkup(await ConfirmationScreen({ bookingRef: 'BK-01001' }));
}

// ---- reading the card ---------------------------------------------------------------------------

const inDetail = (el: El) => { for (let n: El | null = el.parent; n; n = n.parent) if (n.attrs['data-money'] === 'trip-fees-detail') return true; return false; };
/** Row-level lines of a group (the Trip-fees detail rows are not rows of the group). */
const rowsOf = (group: El): El[] => byAttr(group, 'data-money-line').filter((r) => !inDetail(r));
/** A row's amount: its first Money figure outside the detail region. */
function amountOf(row: El): number | undefined {
  const fig = elements(row).find((e) => e !== row && classes(e).includes('tabular-nums') && !inDetail(e));
  return fig ? parseMoney(textOf(fig)) : undefined;
}
const amountTextOf = (row: El): string | undefined => {
  const fig = elements(row).find((e) => e !== row && classes(e).includes('tabular-nums') && !inDetail(e));
  return fig ? textOf(fig) : undefined;
};

type Read = { root: El; card?: El; op?: El; ex?: El; problems: string[] };
function readCard(html: string, label: string): Read {
  const root = parseHtml(html);
  const cards = byAttr(root, 'data-money', 'card');
  if (cards.length !== 1) return { root, problems: [`${label}: ${cards.length} money cards`] };
  const [c] = cards;
  const op = byAttr(c, 'data-money', 'group-operator')[0];
  const ex = byAttr(c, 'data-money', 'group-exotiq')[0];
  return { root, card: c, op, ex, problems: op && ex ? [] : [`${label}: group-operator ${Boolean(op)}, group-exotiq ${Boolean(ex)}`] };
}

/** The surface's total: the `data-money="total"` row, or the mock page's "Total" tile (P2). */
function totalOf(root: El, s: Surface): number | undefined {
  if (s === 'mock') {
    const label = elements(root).find((e) => e.tag === 'div' && norm(textOf(e)) === 'Total' && classes(e).includes('text-faint'));
    const value = label?.parent?.children.filter((x): x is El => typeof x !== 'string')[1];
    return value ? parseMoney(norm(textOf(value))) : undefined;
  }
  const rows = byAttr(root, 'data-money', 'total');
  if (rows.length !== 1) return undefined;
  const fig = elements(rows[0]).find((e) => classes(e).includes('tabular-nums'));
  return fig ? parseMoney(textOf(fig)) : undefined;
}

// ---- AC2: parity ---------------------------------------------------------------------------------

export function parityProblems(label: string, html: string, c: Case, s: Surface): string[] {
  const r = readCard(html, label);
  if (!r.op || !r.ex) return r.problems;
  const p: string[] = [];
  const e = expected(c);
  for (const [name, group, want, sub] of [['operator', r.op, e.operator, e.operatorSubtotal], ['Drive Exotiq', r.ex, e.exotiq, e.exotiqSubtotal]] as const) {
    const rows = rowsOf(group);
    for (const row of rows) {
      const t = amountTextOf(row);
      if (t === undefined) { p.push(`${label}: ${name} ${row.attrs['data-money-line']} has no amount`); continue; }
      try { if (t !== moneyText(parseMoney(t))) p.push(`${label}: ${name} ${row.attrs['data-money-line']} renders "${t}"`); } catch { p.push(`${label}: ${name} ${row.attrs['data-money-line']} renders "${t}"`); }
    }
    const lines = rows.filter((x) => x.attrs['data-money-line'] !== 'subtotal').map((x) => ({ line: x.attrs['data-money-line'], cents: amountOf(x) }));
    const subtotal = amountOf(rows.find((x) => x.attrs['data-money-line'] === 'subtotal') ?? group);
    const sum = lines.reduce((a, x) => a + (x.cents ?? 0), 0);
    if (sum !== subtotal) p.push(`${label}: ${name} lines sum ${sum}, subtotal shows ${subtotal}`);
    if (subtotal !== sub) p.push(`${label}: ${name} subtotal ${subtotal}, charged ${sub}`);
    if (JSON.stringify(lines) !== JSON.stringify(want)) p.push(`${label}: ${name} lines ${JSON.stringify(lines)} expected ${JSON.stringify(want)}`);
  }
  const total = totalOf(r.root, s);
  const a = amountOf(rowsOf(r.op).find((x) => x.attrs['data-money-line'] === 'subtotal') ?? r.op);
  const b = amountOf(rowsOf(r.ex).find((x) => x.attrs['data-money-line'] === 'subtotal') ?? r.ex);
  if (total !== c.grandTotalCents) p.push(`${label}: total ${total}, charged ${c.grandTotalCents}`);
  if ((a ?? 0) + (b ?? 0) !== total) p.push(`${label}: A ${a} + B ${b} != total ${total}`);
  return p;
}

// ---- AC3: structure ------------------------------------------------------------------------------

export function structureProblems(label: string, html: string, c: Case, operatorName = OPERATOR_NAME): string[] {
  const r = readCard(html, label);
  if (!r.card || !r.op || !r.ex) return r.problems;
  const p: string[] = [];
  const groups = elements(r.card).filter((e) => e.attrs.role === 'group');
  if (groups.length !== 2 || groups[0] !== r.op || groups[1] !== r.ex) p.push(`${label}: groups ${groups.map((g) => g.attrs['data-money'] ?? '?').join(',')}`);
  for (const [g, want] of [[r.op, OPERATOR_HEADER(operatorName)], [r.ex, EXOTIQ_HEADER]] as const) {
    const id = g.attrs['aria-labelledby'];
    const head = id ? byId(r.root, id) : undefined;
    if (!head) p.push(`${label}: ${g.attrs['data-money']} has no label`);
    else if (norm(textOf(head)) !== want) p.push(`${label}: ${g.attrs['data-money']} header "${norm(textOf(head))}"`);
  }
  const opKeys = rowsOf(r.op).map((x) => x.attrs['data-money-line']);
  const exKeys = rowsOf(r.ex).map((x) => x.attrs['data-money-line']);
  const wantOp = ['rental', ...(c.taxCents > 0 ? ['operator-tax'] : []), 'subtotal'];
  const wantEx = [...(c.protectionTotalCents > 0 ? ['protect'] : []), 'trip-fees', ...(c.processingFeeCents > 0 ? ['processing'] : []), 'subtotal'];
  if (JSON.stringify(opKeys) !== JSON.stringify(wantOp)) p.push(`${label}: operator rows ${opKeys.join(',')}`);
  if (JSON.stringify(exKeys) !== JSON.stringify(wantEx)) p.push(`${label}: Drive Exotiq rows ${exKeys.join(',')}`);
  const opAmounts = rowsOf(r.op).map(amountOf);
  const exAmounts = rowsOf(r.ex).map(amountOf);
  for (const v of exAmounts) if (opAmounts.includes(v)) p.push(`${label}: Drive Exotiq amount ${v} inside the operator group`);
  if (norm(textOf(r.op)).includes('Exotiq Protect')) p.push(`${label}: Exotiq Protect inside the operator group`);
  const text = norm(textOf(r.root));
  for (const old of OLD_STRINGS) if (text.includes(old) || html.includes(old)) p.push(`${label}: old string "${old}"`);
  return p;
}

// ---- AC4: the disclosure -------------------------------------------------------------------------

export function disclosureProblems(label: string, html: string, o: { open: boolean; percent: boolean; stateFee: number; stateLabel?: string }): string[] {
  const root = parseHtml(html);
  const p: string[] = [];
  const ids = elements(root).map((e) => e.attrs.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) p.push(`${label}: duplicate ids ${dupes.join(',')}`);
  const cards = byAttr(root, 'data-money', 'card');
  if (!cards.length) p.push(`${label}: no money card`);
  for (const cardEl of cards) {
    if (elements(cardEl).some((e) => 'title' in e.attrs)) p.push(`${label}: a title attribute in the card`);
    const toggles = byAttr(cardEl, 'data-money', 'trip-fees-toggle');
    if (toggles.length !== 1) { p.push(`${label}: ${toggles.length} trip-fees toggles`); continue; }
    const [t] = toggles;
    if (t.tag !== 'button' || t.attrs.type !== 'button') p.push(`${label}: the toggle is <${t.tag} type=${t.attrs.type}>`);
    if (norm(textOf(t)) !== 'Trip fees') p.push(`${label}: toggle text "${norm(textOf(t))}"`);
    const icon = elements(t).find((e) => e.tag === 'svg');
    if (!icon || icon.attrs['aria-hidden'] !== 'true') p.push(`${label}: the toggle has no aria-hidden icon`);
    if (t.attrs['aria-expanded'] !== String(o.open)) p.push(`${label}: aria-expanded ${t.attrs['aria-expanded']}, expected ${o.open}`);
    const target = t.attrs['aria-controls'];
    const region = target ? byId(root, target) : undefined;
    if (!target) { p.push(`${label}: the toggle has no aria-controls`); continue; }
    if (!region) { p.push(`${label}: aria-controls "${target}" points at no element`); continue; }
    if (region.attrs['data-money'] !== 'trip-fees-detail' || !contains(cardEl, region)) p.push(`${label}: aria-controls points outside this card's detail`);
    if (('hidden' in region.attrs) === o.open) p.push(`${label}: region ${o.open ? 'hidden while open' : 'visible while collapsed'}`);
    if (region.attrs.class) p.push(`${label}: the region carries classes "${region.attrs.class}" (a display utility beats hidden)`);
    const rows = byAttr(region, 'data-money-line');
    const keys = rows.map((x) => x.attrs['data-money-line']);
    const want = ['platform-fee', ...(o.stateFee > 0 ? ['state-fee'] : [])];
    if (JSON.stringify(keys) !== JSON.stringify(want)) p.push(`${label}: detail rows ${keys.join(',')}`);
    const platform = rows.find((x) => x.attrs['data-money-line'] === 'platform-fee');
    if (platform && !norm(textOf(platform)).startsWith('Platform fee')) p.push(`${label}: platform row "${norm(textOf(platform))}"`);
    if (platform && norm(textOf(platform)).includes('10% of the rental') !== o.percent) p.push(`${label}: platform percent ${o.percent ? 'missing' : 'guessed'}`);
    if (!o.percent && norm(textOf(region)).includes('%')) p.push(`${label}: a percent in the live detail`);
    const state = rows.find((x) => x.attrs['data-money-line'] === 'state-fee');
    if (state && !norm(textOf(state)).startsWith(o.stateLabel ?? 'State rental fee')) p.push(`${label}: state row "${norm(textOf(state))}"`);
    const detailSum = rows.reduce((a, x) => a + (parseMoney(textOf(elements(x).find((e) => classes(e).includes('tabular-nums')) ?? x)) || 0), 0);
    const tripRow = byAttr(cardEl, 'data-money-line', 'trip-fees')[0];
    if (!tripRow || amountOf(tripRow) !== detailSum) p.push(`${label}: detail sums ${detailSum}, Trip fees ${tripRow ? amountOf(tripRow) : '?'}`);
  }
  return p;
}
/** Hover-only reveals in a source file (AC4: nothing reveals on hover). */
export const hoverReveals = (text: string) => text.split(/[\s'"`{}]+/).filter((t) => /(^|:)(group-|peer-)?hover:(block|flex|grid|inline|visible|opacity-100|h-auto|max-h-|not-sr-only)/.test(t));

// ---- AC5: Protect --------------------------------------------------------------------------------

export function protectProblems(label: string, html: string, c: Case, golden?: string): string[] {
  const r = readCard(html, label);
  if (!r.card || !r.op || !r.ex) return r.problems;
  const p: string[] = [];
  const protect = rowsOf(r.ex).filter((x) => x.attrs['data-money-line'] === 'protect');
  const trip = rowsOf(r.ex).find((x) => x.attrs['data-money-line'] === 'trip-fees');
  if (trip && amountOf(trip) !== c.platformFeeCents + c.stateFeeCents) p.push(`${label}: Trip fees ${amountOf(trip)} != platform + state ${c.platformFeeCents + c.stateFeeCents}`);
  if (c.protect) {
    if (protect.length !== 1 || amountOf(protect[0]) !== c.protectionTotalCents) p.push(`${label}: Protect row ${protect.length ? amountOf(protect[0]) : 'missing'}`);
  } else {
    if (protect.length) p.push(`${label}: a Protect row under a declined cart`);
    if (norm(textOf(r.ex)).includes('Exotiq Protect')) p.push(`${label}: "Exotiq Protect" inside the Drive Exotiq group`);
    if (/\$0(?:\.00)?(?![\d.,])/.test(norm(textOf(r.ex)))) p.push(`${label}: a $0 figure in the Drive Exotiq group`);
  }
  if (golden !== undefined) {
    const sw = switchBlockEl(r.root);
    if (!sw) p.push(`${label}: no Protect switch`);
    else {
      if (outer(html, sw) !== golden) p.push(`${label}: the switch differs from the base golden`);
      if (!(orderOf(r.root, r.op) < orderOf(r.root, sw) && orderOf(r.root, sw) < orderOf(r.root, r.ex)) || contains(r.op, sw) || contains(r.ex, sw)) p.push(`${label}: the switch is not between the two groups`);
      if (!contains(r.card, sw)) p.push(`${label}: the switch is outside the card`);
    }
  }
  return p;
}

// ---- AC6: hierarchy and restraint ---------------------------------------------------------------

export function hierarchyProblems(label: string, html: string): string[] {
  const r = readCard(html, label);
  if (!r.op || !r.ex) return r.problems;
  const p: string[] = [];
  for (const g of [r.op, r.ex]) {
    const head = byId(r.root, g.attrs['aria-labelledby'] ?? '');
    const parts = head ? head.children.filter((x): x is El => typeof x !== 'string') : [];
    const [name, desc] = parts;
    if (!name || !classes(name).includes('font-semibold') || !classes(name).includes('text-ink')) p.push(`${label}: ${g.attrs['data-money']} name lacks font-semibold text-ink`);
    if (!desc || !(classes(desc).includes('text-muted') || classes(desc).includes('text-faint')) || classes(desc).includes('font-semibold')) p.push(`${label}: ${g.attrs['data-money']} descriptor "${desc?.attrs.class}"`);
    if (head && goldCount(outer(html, head))) p.push(`${label}: gold in a header`);
  }
  const ex = classes(r.ex);
  if (!ex.includes('border-t') || !ex.includes('border-line') || !(ex.includes('mt-4') || ex.includes('pt-4'))) p.push(`${label}: the Drive Exotiq group is not set off by a hairline and spacing ("${r.ex.attrs.class}")`);
  return p;
}
const NAMED_STEPS = new Set(['micro', 'label', 'body-sm', 'body', 'body-lg', 'title-sm', 'title', 'heading', 'display', 'display-lg', 'display-xl']);
export function sourceRestraintProblems(rel: string, text: string): string[] {
  const p: string[] = [];
  const prepared = prepare(rel, text);
  if (goldCount(prepared)) p.push(`${rel}: ${goldCount(prepared)} gold reference(s)`);
  const boxes = literals(prepared).filter(isBox);
  if (boxes.length) p.push(`${rel}: box ${boxes.map((b) => `"${b}"`).join(', ')}`);
  if (/#[0-9a-fA-F]{3,8}\b/.test(prepared)) p.push(`${rel}: a hex colour`);
  if (prepared.includes('rgba(')) p.push(`${rel}: an rgba() colour`);
  if (prepared.includes('shadow-[')) p.push(`${rel}: a shadow`);
  for (const t of prepared.split(/[\s'"`{}]+/)) {
    const m = /(?:^|:)text-(xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])$/.exec(t);
    if (m) p.push(`${rel}: off-scale size ${t}`);
    const step = /(?:^|:)text-(micro|label|body-sm|body-lg|body|title-sm|title|heading|display-xl|display-lg|display)$/.exec(t);
    if (step && !NAMED_STEPS.has(step[1])) p.push(`${rel}: size ${t}`);
  }
  for (const t of hoverReveals(prepared)) p.push(`${rel}: hover reveal ${t}`);
  return p;
}

// ---- AC9: the merged step ------------------------------------------------------------------------

const REMOVED = ['Proceed to payment', 'Total due today', 'Reserve your dates.', 'Review your details before payment.', 'Free cancellation up to 72 hours before pickup.'];
const stickyOf = (root: El) => elements(root).find((e) => ['absolute', 'left-0', 'right-0', 'z-10'].every((k) => classes(e).includes(k)));
const findText = (root: El, tag: string, text: string) => elements(root).find((e) => e.tag === tag && norm(textOf(e)) === text);
const PAYLINK = `${OPERATOR_NAME} reviews your request, then we email you a secure payment link. Your card is only charged when you pay from that link.`;
const STATEMENT = `Two charges: ${OPERATOR_NAME}, and EXOTIQ.RENT for Trip fees and protection.`;

export function mergedOrderProblems(html: string): string[] {
  const root = parseHtml(html);
  const p: string[] = [];
  const header = elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === 'mb-4');
  const hEls = header ? header.children.filter((x): x is El => typeof x !== 'string') : [];
  const sticky = stickyOf(root);
  const buttons = sticky ? elements(sticky).filter((e) => e.tag === 'button') : [];
  const r = readCard(html, 'merged');
  const anchors: [string, El | undefined][] = [
    ['eyebrow "Step 3 of 3"', hEls[0] && norm(textOf(hEls[0])) === 'Step 3 of 3' ? hEls[0] : undefined],
    ['h1 "Here\'s the breakdown."', hEls[1] && hEls[1].tag === 'h1' && norm(textOf(hEls[1])) === "Here's the breakdown." ? hEls[1] : undefined],
    ['sub "Nothing is charged yet."', hEls[2] && norm(textOf(hEls[2])) === 'Nothing is charged yet.' ? hEls[2] : undefined],
    ['summary grid', elements(root).find((e) => classes(e).includes('grid') && classes(e).includes('grid-cols-3'))],
    ['group-operator', r.op],
    ['Protect switch', switchBlockEl(root)],
    ['group-exotiq', r.ex],
    ['total "Total once approved"', byAttr(root, 'data-money', 'total').find((e) => norm(textOf(e)).startsWith('Total once approved'))],
    ['payment-link sentence', findText(root, 'p', PAYLINK)],
    ['deposit disclosure', elements(root).find((e) => e.tag === 'div' && norm(textOf(e)) === 'Damage deposit at pickup')],
    ['statement heading', elements(root).find((e) => e.tag === 'div' && norm(textOf(e)) === "What you'll see on your statement")],
    ['statement line', findText(root, 'p', STATEMENT)],
    ['Cancellation & coverage', findText(root, 'summary', 'Cancellation & coverage')],
    ['terms checkbox', elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === 'I agree to the Rental Terms & Conditions.')],
    ['MP-14 opt-in', elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === CONSENT_TEXT.booking.text)],
    ['request error banner', sticky ? elements(sticky).find((e) => classes(e).includes('border-danger/45') && classes(e).includes('bg-danger/10')) : undefined],
    ['"Request this booking"', buttons.find((b) => norm(textOf(b)) === 'Request this booking')],
  ];
  let last = -1;
  for (const [name, el] of anchors) {
    if (!el) { p.push(`missing: ${name}`); continue; }
    const at = orderOf(root, el);
    if (at <= last) p.push(`out of order: ${name}`);
    last = Math.max(last, at);
  }
  const golds = elements(root).filter((e) => classes(e).includes('text-gold') && elements(e).some((x) => classes(x).includes('tabular-nums')));
  const totalRow = byAttr(root, 'data-money', 'total')[0];
  if (golds.length !== 1) p.push(`${golds.length} text-gold figures on the step`);
  else if (!totalRow || !contains(totalRow, golds[0])) p.push('the gold figure is not the total');
  for (const s of REMOVED) if (norm(textOf(root)).includes(s)) p.push(`removed string on the step: ${s}`);
  return p;
}

// ---- the tests -----------------------------------------------------------------------------------

describe('MP-26 two-party money card on every surface', () => {
  it('rendered amounts equal the charged cents on every surface', async () => {
    const problems: string[] = [];
    const evidence: { surface: string; case: string; rendered: Record<string, string>; source: Record<string, number> }[] = [];
    let count = 0;
    for (const s of SURFACES) {
      for (const c of casesFor(s)) {
        const html = await render(s, c);
        problems.push(...parityProblems(`${NAME[s]} ${c.id}`, html, c, s));
        count++;
      }
      for (const g of sample64()) {
        const c = s === 'mock' ? mockShape(g) : g;
        const html = await render(s, c);
        problems.push(...parityProblems(`${NAME[s]} ${c.id}`, html, c, s));
        count++;
        if (evidence.length < 8 && s === 'review') {
          const r = readCard(html, '');
          const rows = [...(r.op ? rowsOf(r.op) : []), ...(r.ex ? rowsOf(r.ex) : [])];
          evidence.push({ surface: NAME[s], case: c.id, rendered: Object.fromEntries(rows.map((x, i) => [`${i < (r.op ? rowsOf(r.op).length : 0) ? 'A' : 'B'}:${x.attrs['data-money-line']}`, amountTextOf(x) ?? ''])), source: { operatorTotalCents: c.operatorTotalCents, operatorTaxCents: c.taxCents, platformFeeCents: c.platformFeeCents, protectionTotalCents: c.protectionTotalCents, stateFeeCents: c.stateFeeCents, processingFeeCents: c.processingFeeCents, exotiqTotalCents: c.exotiqTotalCents, grandTotalCents: c.grandTotalCents } });
        }
      }
    }

    // Planted: each unhappy shape is caught and named.
    const fx = fixture('FX-T1S1P1');
    const good = await render('payment', fx);
    if (!problems.some((x) => x.startsWith('payment link'))) {
      expect(parityProblems('payment link FX-T1S1P1', good, fx, 'payment')).toEqual([]);
      expect(parityProblems('payment link FX-T1S1P1', good.replace('$1,223.37', '$1,223.38'), fx, 'payment').join()).toContain('payment link FX-T1S1P1: Drive Exotiq');
      expect(parityProblems('payment link FX-T1S1P1', good.replace('$1,223.37', '$1,182'), fx, 'payment').join()).toContain('subtotal');
      expect(parityProblems('payment link FX-T1S1P1', good.replace('$4,448.37', '$4,448'), fx, 'payment').join()).toContain('total 444800');
    }
    expect(() => assertCanary({ ...fx, exotiqTotalCents: fx.exotiqTotalCents - fx.processingFeeCents })).toThrow(/canary exotiq/);
    expect(() => assertCanary({ ...fx, grandTotalCents: fx.grandTotalCents + 1 })).toThrow(/canary grand/);
    expect(moneyText(122337)).toBe('$1,223.37');
    expect(moneyText(300000)).toBe('$3,000');

    if (EVIDENCE) {
      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, 'AC2-parity-grid.json'), JSON.stringify({ test: 'tests/fees/fees.surfaces.test.tsx "rendered amounts equal the charged cents on every surface"', count, surfaces: SURFACES.map((s) => NAME[s]), fixtures: SURFACES.map((s) => ({ surface: NAME[s], cases: casesFor(s).map((c) => c.id) })), gridSample: { size: sample64().length, rule: 'every 34th case of the 2,160-case grid from index 0', perSurface: true, mockNote: 'the mock block shows its own cart (tax 0, no state fee, no processing): the sample keeps each case\'s days, rate and Protect' }, mismatches: problems.length, firstCases: evidence }, null, 1));
    }
    expect(problems).toEqual([]);
  });

  it('every surface renders the operator group then the Drive Exotiq group', async () => {
    const problems: string[] = [];
    for (const s of SURFACES) for (const c of casesFor(s)) problems.push(...structureProblems(`${NAME[s]} ${c.id}`, await render(s, c), c));

    // The pre-approval "Operator rental total" block shows one leg and no card (O1 not taken).
    svc.confirmation = { ...confirmationOf(fixture('FX-T1S1P1'), 'paid'), live: { ...liveOf(fixture('FX-T1S1P1'), 'paid'), status: 'requested', paidAt: undefined } };
    const pre = renderToStaticMarkup(await ConfirmationScreen({ bookingRef: BOOKING_REF, accessToken: ACCESS_TOKEN }));
    if (!pre.includes('Operator rental total')) problems.push('pre-approval: the Operator rental total block is gone');
    if (pre.includes('data-money="card"')) problems.push('pre-approval: renders a money card');

    // Planted: swapped groups, a third group, an unlabelled group, a tax row at tax 0.
    const fx = fixture('FX-T0S1P1');
    const good = await render('payment', fx);
    if (!problems.some((x) => x.startsWith('payment link'))) {
      expect(structureProblems('p', good, fx)).toEqual([]);
      const swapped = good.replace('data-money="group-operator"', 'data-money="tmp"').replace('data-money="group-exotiq"', 'data-money="group-operator"').replace('data-money="tmp"', 'data-money="group-exotiq"');
      expect(structureProblems('p', swapped, fx).length).toBeGreaterThan(0);
      expect(structureProblems('p', good.replace('data-money="group-exotiq"', 'data-money="group-exotiq"><div role="group"></div'), fx).join()).toContain('groups');
      expect(structureProblems('p', good.replace(/(data-money="group-operator"[^>]*?)aria-labelledby="[^"]*"/, '$1'), fx).join() + structureProblems('p', good.replace(/aria-labelledby="([^"]*)"([^>]*data-money="group-operator")/, '$2'), fx).join()).toContain('no label');
      expect(structureProblems('p', good.replace('data-money-line="rental"', 'data-money-line="operator-tax"'), fx).join()).toContain('operator rows');
      expect(structureProblems('p', good.replace('Drive Exotiq', 'Exotiq.Rent'), fx).join()).toContain('Exotiq.Rent');
    }
    expect(problems).toEqual([]);
  });

  it('Trip fees detail is a button disclosure with per-component amounts', async () => {
    const problems: string[] = [];
    for (const s of SURFACES) {
      for (const c of casesFor(s)) {
        const known = s === 'review' || s === 'mock';
        problems.push(...disclosureProblems(`${NAME[s]} ${c.id}`, await render(s, c), { open: false, percent: known, stateFee: c.stateFeeCents, stateLabel: known ? c.stateFeeLabel : undefined }));
      }
    }
    const k = await card();
    const f = await fold();
    if (!k || !f) problems.push('FeeCard.tsx / feeGroups.ts missing');
    else {
      const { TwoPartyBreakdown } = k;
      for (const c of fixtures()) {
        for (const known of [true, false]) {
          const groups = f.foldFees(foldInputOf(c, known));
          problems.push(...disclosureProblems(`open ${c.id} ${known ? 'quote' : 'live'}`, renderToStaticMarkup(<TwoPartyBreakdown groups={groups} defaultOpen />), { open: true, percent: known, stateFee: c.stateFeeCents, stateLabel: known ? c.stateFeeLabel : undefined }));
        }
      }
      // Two cards on one page get distinct ids.
      const two = renderToStaticMarkup(<Fragment><TwoPartyBreakdown groups={f.foldFees(foldInputOf(fixture('FX-T1S1P1')))} /><TwoPartyBreakdown groups={f.foldFees(foldInputOf(fixture('FX-T0S0P0')))} /></Fragment>);
      problems.push(...disclosureProblems('two cards', two, { open: false, percent: true, stateFee: -1 }).filter((x) => !x.includes('detail rows') && !x.includes('detail sums')));
      for (const t of hoverReveals(prepare(FEECARD, read(FEECARD)))) problems.push(`${FEECARD}: hover reveal ${t}`);

      // Planted: each broken disclosure is caught.
      const fx = fixture('FX-T1S1P1');
      const good = renderToStaticMarkup(<TwoPartyBreakdown groups={f.foldFees(foldInputOf(fx))} />);
      const o = { open: false, percent: true, stateFee: fx.stateFeeCents, stateLabel: fx.stateFeeLabel };
      expect(disclosureProblems('p', good, o)).toEqual([]);
      expect(disclosureProblems('p', good.replace('aria-hidden="true"', 'title="Trip fees info"'), o).join()).toContain('title');
      expect(disclosureProblems('p', good.replace(/ aria-controls="[^"]*"/, ''), o).join()).toContain('no aria-controls');
      expect(disclosureProblems('p', good.replace(/aria-controls="([^"]*)"/, 'aria-controls="$1-x"'), o).join()).toContain('points at no element');
      expect(disclosureProblems('p', good.replace(' hidden=""', ''), o).join()).toContain('visible while collapsed');
      expect(disclosureProblems('p', `${good}${good}`, o).join()).toContain('duplicate ids');
      expect(disclosureProblems('p', good, { ...o, stateFee: 0 }).join()).toContain('detail rows');
      expect(hoverReveals('group-hover:block hover:text-ink')).toEqual(['group-hover:block']);
    }
    expect(problems).toEqual([]);
  });

  it('Protect is its own line when on, absent when declined, and the switch is unchanged', async () => {
    const problems: string[] = [];
    for (const s of SURFACES) {
      for (const c of casesFor(s)) {
        const golden = s === 'review' ? readGolden(c.protect ? 'protect-switch-on.html' : 'protect-switch-off.html') : undefined;
        problems.push(...protectProblems(`${NAME[s]} ${c.id}`, await render(s, c), c, golden));
      }
    }
    if (!stripComments(read(REVIEW)).includes("onClick={() => onProtectionChange(protectionOn ? 'decline' : 'premium')}")) problems.push('ReviewStep: the switch no longer flips with onProtectionChange(protectionOn ? \'decline\' : \'premium\')');

    // Planted: Protect folded into Trip fees, a $0 Protect row, a changed switch class, the switch after the group.
    const on = fixture('FX-T1S1P1');
    const off = fixture('FX-T1S1P0');
    const goodOn = await render('review', on);
    const goodOff = await render('review', off);
    if (!problems.some((x) => x.startsWith('Review'))) {
      expect(protectProblems('p', goodOn, on, readGolden('protect-switch-on.html'))).toEqual([]);
      expect(protectProblems('p', goodOn.replace('$315', '$1,182'), on).join()).toContain('Trip fees');
      const offEx = goodOff.replace('data-money="group-exotiq"', 'data-money="group-exotiq"><div data-money-line="protect">Exotiq Protect <span class="tabular-nums">$0</span></div><div x=""');
      expect(protectProblems('p', offEx, off).join()).toContain('declined');
      expect(protectProblems('p', goodOn.replace('focus-visible:ring-offset-panel bg-gold', 'focus-visible:ring-offset-panel bg-gold/90'), on, readGolden('protect-switch-on.html')).join()).toContain('differs');
      const sw = switchBlock(goodOn);
      const moved = goodOn.replace(sw, '').replace('data-money="total"', `data-money="total">${sw}<div x=""`);
      expect(protectProblems('p', moved, on, readGolden('protect-switch-on.html')).join()).toContain('between');
    }
    expect(problems).toEqual([]);
  });

  it('group headers get weight and spacing, never gold or a box', async () => {
    const problems: string[] = [];
    for (const s of SURFACES) problems.push(...hierarchyProblems(`${NAME[s]}`, await render(s, casesFor(s)[casesFor(s).length - 1])));
    for (const rel of [FEECARD, FEEGROUPS]) {
      if (!existsSync(join(REPO, rel))) { problems.push(`${rel} missing`); continue; }
      problems.push(...sourceRestraintProblems(rel, read(rel)));
    }
    // Planted: gold, a box, a hex and an off-scale size are each caught.
    expect(sourceRestraintProblems('x.tsx', 'const a = "text-gold";')).toHaveLength(1);
    expect(sourceRestraintProblems('x.tsx', 'const a = "rounded-xl border border-line bg-surface p-4";')).toHaveLength(1);
    expect(sourceRestraintProblems('x.tsx', "const a = 'text-sm'; const b = '#C8A664';").length).toBeGreaterThanOrEqual(2);
    expect(hierarchyProblems('p', '<div data-money="card"><div role="group" data-money="group-operator" aria-labelledby="a"><div id="a"><span class="font-medium text-ink">X</span><span class="text-muted"> · y</span></div></div><div role="group" data-money="group-exotiq" aria-labelledby="b"><div id="b"><span class="font-semibold text-gold">D</span><span class="text-muted">z</span></div></div></div>').length).toBeGreaterThanOrEqual(3);
    expect(problems).toEqual([]);
  });

  it('the merged step carries breakdown, switch, total, terms and the request button in order', async () => {
    const problems: string[] = [];
    const fx = fixture('FX-T1S1P1');
    const html = await render('review', fx, { requestError: 'That car was just booked for those dates.' });
    problems.push(...mergedOrderProblems(html));
    const plain = parseHtml(await render('review', fx));
    if (byAttr(plain, 'class').some((e) => classes(e).includes('border-danger/45') && contains(stickyOf(plain) ?? plain, e))) problems.push('the request error banner renders with no requestError');
    // The blocked branch keeps its shape with the merged sub-line.
    const blocked = parseHtml(renderToStaticMarkup(<Review cart={reviewCartOf(fx)} goTo={noop} onRequest={noop} quote={null} blocked quotePending />));
    if (!findText(blocked, 'p', 'Nothing is charged yet.')) problems.push('blocked branch: sub is not "Nothing is charged yet."');
    if (norm(textOf(blocked)).includes('Total once approved')) problems.push('blocked branch: shows a total');
    // None of the removed strings anywhere under components/drive-exotiq/ (comments included).
    const { readdirSync } = await import('node:fs');
    const walk = (dir: string): string[] => readdirSync(join(REPO, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    for (const rel of walk('components/drive-exotiq')) for (const s of REMOVED) if (read(rel).includes(s)) problems.push(`${rel}: still says "${s}"`);
    // "Total once approved" is the step's one gold figure and its first occurrence carries it (MP-16's frame).
    const review = stripComments(read(REVIEW));
    if (!/Total once approved[\s\S]{0,200}<span className="text-gold"><Money cents=\{m\.grandTotalCents\} large \/><\/span>/.test(review)) problems.push('ReviewStep: the total figure is not <span className="text-gold"><Money cents={m.grandTotalCents} large /></span>');
    if (!review.includes('<LockKeyhole size={16} className="mt-0.5 shrink-0 text-muted" />')) problems.push('ReviewStep: the statement block lost its muted lock icon');
    if (/-warn(?![A-Za-z0-9])/.test(review)) problems.push('ReviewStep: a warn utility');

    if (EVIDENCE) {
      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, 'AC9-merged-step-markup.html'), `<!-- MP-26 AC9: react-dom/server markup of ReviewStep (Review & Request) with FX-T1S1P1 and a requestError, from tests/fees/fees.surfaces.test.tsx -->\n${html}\n`);
    }
    // Planted: the old total label back, two gold figures, the terms before the details.
    if (!problems.length) {
      expect(mergedOrderProblems(html.replace('Total once approved', 'Total due today')).join()).toContain('Total once approved');
      expect(mergedOrderProblems(html.replace('<span class="text-gold"><span class="text-heading', '<span class="text-heading')).join()).toContain('text-gold');
    }
    expect(problems).toEqual([]);
  });

  it('the payment link shows the two-party structure and keeps its states', async () => {
    const problems: string[] = [];
    const pc = stripComments(read(PAYCARD));
    // Props unchanged: ConfirmationScreen passes the same eleven.
    const params = /export function PaymentCard\(\{([\s\S]*?)\}: \{/.exec(pc)?.[1].split(',').map((x) => x.trim()).filter(Boolean);
    if (JSON.stringify(params) !== JSON.stringify(['bookingRef', 'accessToken', 'dueAtIso', 'rentalCents', 'platformFeeCents', 'protectionTotalCents', 'stateFeeCents = 0', 'processingFeeCents = 0', 'operatorTaxCents = 0', 'operatorTaxLabel', 'operatorName'])) problems.push(`PaymentCard props ${JSON.stringify(params)}`);
    if (!pc.includes('const exotiqCents = platformFeeCents + protectionTotalCents + stateFeeCents + processingFeeCents;')) problems.push('PaymentCard: exotiqCents is no longer the four-component sum');
    if (!/<span>Total due<\/span><span className="text-gold"><Money cents=\{rentalCents \+ exotiqCents\} large \/><\/span>/.test(pc)) problems.push('PaymentCard: the Total due row changed');
    for (const c of fixtures()) {
      const root = parseHtml(await render('payment', c));
      const total = byAttr(root, 'data-money', 'total')[0];
      if (!total || !norm(textOf(total)).startsWith('Total due')) problems.push(`${c.id}: no "Total due" row`);
      const gold = total ? elements(total).find((e) => classes(e).includes('text-gold')) : undefined;
      if (!gold || parseMoney(norm(textOf(gold))) !== c.operatorTotalCents + c.platformFeeCents + c.protectionTotalCents + c.stateFeeCents + c.processingFeeCents) problems.push(`${c.id}: Total due is not rentalCents + the four components in gold`);
      const statement = elements(root).find((e) => e.tag === 'p' && norm(textOf(e)).startsWith('Two charges on your statement'));
      if (!statement || norm(textOf(statement)) !== "Two charges on your statement: the operator's rental, and an EXOTIQ RENT charge covering Trip fees, protection, the state rental fee and card processing. One card entry.") problems.push(`${c.id}: statement paragraph "${statement ? norm(textOf(statement)) : ''}"`);
      if (!elements(root).some((e) => e.tag === 'button' && norm(textOf(e)) === 'Complete payment')) problems.push(`${c.id}: no Complete payment button`);
    }
    if (!/<button\s+type="button"\s+onClick=\{pay\}/.test(pc)) problems.push('PaymentCard: the pay button lost onClick={pay}');
    // The expired window renders no card.
    const expired = renderToStaticMarkup(<PaymentCard {...paymentPropsOf(fixture('FX-T1S1P1'))} dueAtIso="2026-10-30T00:00:00.000Z" />);
    if (!expired.includes('Payment window closed') || expired.includes('data-money')) problems.push('expired: still renders the card');
    // The finalizing, expired and notice states are unchanged (always-on pins; byte-compared with MP26_BASE_REF).
    for (const pin of ['Payment received — finalizing', 'Payment window closed', "notice.kind === 'danger' ? 'border-danger/45 bg-danger/10' : 'border-warn/45 bg-warn/10'", "windowState === 'urgent' ? 'bg-warn/15 text-warn' : 'bg-surface2 text-ink'"]) if (!pc.includes(pin)) problems.push(`PaymentCard: missing ${pin}`);
    if (BASE) {
      const { execFileSync } = await import('node:child_process');
      const before = stripComments(execFileSync('git', ['show', `${BASE}:${PAYCARD}`], { cwd: REPO, encoding: 'utf8' }));
      const blockOf = (t: string, from: string, to: string) => t.slice(t.indexOf(from), t.indexOf(to, t.indexOf(from)));
      for (const [from, to] of [['if (finalizing) {', "if (windowState === 'expired') {"], ["if (windowState === 'expired') {", 'return (\n    <div className="mt-4 rounded-xl border border-line bg-surface p-4">\n      <div className="flex items-start'], ['{notice && <p className={`mt-3 rounded-xl', '</div>\n  );\n}']]) {
        if (blockOf(before, from, to) !== blockOf(pc, from, to)) problems.push(`PaymentCard: the block from "${from.slice(0, 30)}" changed`);
      }
    }
    // Planted: a percent in the live detail, the lump back, a total short by processing.
    const fx = fixture('FX-T1S1P1');
    const good = await render('payment', fx);
    if (!problems.length) {
      expect(disclosureProblems('p', good.replace('Platform fee', 'Platform fee 10%'), { open: false, percent: false, stateFee: fx.stateFeeCents }).join()).toContain('percent');
      expect(structureProblems('p', good.replace('Trip fees</button>', 'Protection &amp; fees</button>'), fx).join()).toContain('Protection');
      expect(parityProblems('p', good.replace('$4,448.37', '$4,407'), fx, 'payment').join()).toContain('total');
    }
    expect(problems).toEqual([]);
  });

  it('the paid receipt and the mock charges use the two-party structure with their statement notes', async () => {
    const problems: string[] = [];
    for (const c of fixtures()) {
      const html = await render('paid', c);
      const r = readCard(html, `paid ${c.id}`);
      problems.push(...r.problems);
      if (!r.op) continue;
      const note = c.taxCents > 0 ? `Statement shows ${OPERATOR_NAME} — one charge including tax` : `Appears as ${OPERATOR_NAME} on your statement`;
      const noteEl = elements(r.op).find((e) => norm(textOf(e)) === note && e.children.every((x) => typeof x === 'string'));
      const sub = rowsOf(r.op).find((x) => x.attrs['data-money-line'] === 'subtotal');
      if (!noteEl || !sub || orderOf(r.root, noteEl) < orderOf(r.root, sub) || !classes(noteEl).includes('text-label') || !classes(noteEl).includes('text-faint')) problems.push(`paid ${c.id}: the statement note "${note}" is not under the operator subtotal in text-label text-faint`);
      const total = byAttr(r.root, 'data-money', 'total')[0];
      if (!total || !norm(textOf(total)).startsWith('Total paid') || totalOf(r.root, 'paid') !== c.operatorTotalCents + c.platformFeeCents + c.protectionTotalCents + c.stateFeeCents + c.processingFeeCents) problems.push(`paid ${c.id}: Total paid is not live.totalCents + the four components`);
      if (total && elements(total).some((e) => goldCount(e.attrs.class ?? ''))) problems.push(`paid ${c.id}: Total paid is gold`);
      if (!norm(textOf(r.root)).includes('Paid — your receipt')) problems.push(`paid ${c.id}: lost its heading`);
    }
    for (const protect of [true, false]) {
      const c = mockCase(protect);
      const html = await render('mock', c);
      const r = readCard(html, `mock ${c.id}`);
      problems.push(...r.problems);
      const detail = byAttr(r.root, 'data-money-line', 'platform-fee')[0];
      if (!detail || !norm(textOf(detail)).includes('10% of the rental')) problems.push(`mock ${c.id}: the detail lost "10% of the rental"`);
      if (!norm(textOf(r.root)).includes('Charges')) problems.push(`mock ${c.id}: lost its Charges heading`);
    }
    const conf = read(CONF);
    if (conf.includes('Trip Fees')) problems.push('ConfirmationScreen.tsx still says "Trip Fees"');
    if (goldCount(prepare(CONF, conf).replace(/\banimate-gold-sheen\b/, ''))) problems.push('ConfirmationScreen carries gold beyond the sheen');
    if (!stripComments(conf).includes('(live.platformFeeCents ?? 0) + (live.protectionTotalCents ?? 0) + (live.stateFeeCents ?? 0) + (live.processingFeeCents ?? 0)')) problems.push('ConfirmationScreen: exotiqLegCents is no longer the one four-component sum');
    // Planted: a receipt without its note, a two-component "Total paid", the mock block without its percent.
    const fx = fixture('FX-T1S1P1');
    const good = await render('paid', fx);
    if (!problems.length) {
      const root = parseHtml(good.replace(`Statement shows ${OPERATOR_NAME} — one charge including tax`, ''));
      const op = byAttr(root, 'data-money', 'group-operator')[0];
      expect(elements(op).some((e) => norm(textOf(e)) === `Statement shows ${OPERATOR_NAME} — one charge including tax`)).toBe(false);
      expect(parityProblems('p', good.replace('$4,448.37', moneyText(fx.operatorTotalCents + fx.platformFeeCents + fx.protectionTotalCents)), fx, 'paid').join()).toContain('total');
      const mock = await render('mock', mockCase(true));
      expect(norm(textOf(parseHtml(mock.replace('10% of the rental', ''))))).not.toContain('10% of the rental');
    }
    expect(problems).toEqual([]);
  });

  it('the MP-14 opt-in keeps its wording and unchecked default on the merged step', async () => {
    const problems: string[] = [];
    const fx = fixture('FX-T1S1P1');
    const optIn = (root: El) => elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === CONSENT_TEXT.booking.text);
    const check = (html: string, label: string) => {
      const root = parseHtml(html);
      const el = optIn(root);
      if (!el) return [`${label}: no opt-in`];
      const p: string[] = [];
      const box = elements(el).find((e) => e.tag === 'input');
      if (!box || box.attrs.type !== 'checkbox' || 'checked' in box.attrs) p.push(`${label}: the opt-in is not an unchecked checkbox`);
      const terms = elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === 'I agree to the Rental Terms & Conditions.');
      if (!terms || orderOf(root, el) < orderOf(root, terms)) p.push(`${label}: the opt-in does not follow the terms`);
      const sticky = stickyOf(root);
      if (sticky && contains(sticky, el)) p.push(`${label}: the opt-in sits inside Sticky`);
      const span = elements(el).find((e) => e.tag === 'span');
      if (!span || textOf(span) !== CONSENT_TEXT.booking.text) p.push(`${label}: wording changed`);
      return p;
    };
    problems.push(...check(await render('review', fx), 'capture on'));
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'off');
    if (optIn(parseHtml(await render('review', fx)))) problems.push('capture off: the opt-in renders');
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
    if (optIn(parseHtml(await render('review', fx, { onMarketingConsentChange: undefined })))) problems.push('no handler: the opt-in renders');
    // The words a person agreed to, byte-identical to the base.
    const pinned = {
      form: { version: 'form-2026-09-04', text: 'Also send me first looks at new cars and early access from Drive Exotiq. Unsubscribe any time.' },
      footer: { version: 'footer-2026-09-04', text: 'Keep me posted: occasional e-mail from Drive Exotiq about new cars and early access. Unsubscribe any time.' },
      booking: { version: 'review-2026-09-04', text: 'Keep me posted on new cars and early access from Drive Exotiq. Occasional e-mail, unsubscribe any time.' },
      confirm: { version: 'confirm-2026-09-04', text: 'first looks at new cars and early access (occasional e-mail, unsubscribe any time)', button: 'Confirm and send me first looks' },
    };
    if (JSON.stringify(CONSENT_TEXT) !== JSON.stringify(pinned)) problems.push('CONSENT_TEXT changed');
    // Planted: checked by default, moved into Sticky, one character changed.
    const good = await render('review', fx);
    if (!problems.length) {
      expect(check(good, 'p')).toEqual([]);
      const optHtml = outer(good, optIn(parseHtml(good))!);
      expect(check(good.replace(optHtml, optHtml.replace('type="checkbox"', 'type="checkbox" checked=""')), 'p').join()).toContain('unchecked');
      expect(check(good.replace(optHtml, '').replace('<div class="space-y-3">', `<div class="space-y-3">${optHtml}`), 'p').join()).toContain('Sticky');
      expect(check(good.replace('Occasional e-mail', 'Occasional email'), 'p').join()).toContain('no opt-in');
    }
    expect(problems).toEqual([]);
  });
});
