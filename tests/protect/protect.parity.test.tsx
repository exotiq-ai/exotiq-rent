// MP-30 AC11: with the flag off, money keeps MP-26's cent parity. A seeded engine run of 2,000
// random carts through the flag-off seed path, and every rendered amount on the four declined
// fixtures' Review, payment link and paid receipt and on the mock confirmation equals the charged
// cents. MP-26's card readers are copied here, never imported (importing a test file registers its
// tests). Red on the base by design (the flag module does not exist; the mock cart is premium).
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

import TeamStorefrontRoute from '@/app/[operatorSlug]/page';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { PaymentCard } from '@/components/drive-exotiq/PaymentCard';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { recomputeBookingCart } from '@/components/drive-exotiq/flow/state';
import { createInitialCart } from '@/domain/booking/mockData';
import type { PublicBookingConfirmation } from '@/domain/booking/publicContracts';
import type { BookingCart } from '@/domain/booking/types';
import { stripComments } from '../design/lib/scan.mjs';
import { between, literals, sliceFunction } from '../restraint/restraintScan';
import { ACCESS_TOKEN, BOOKING_REF, type Case, type El, NOW_ISO, OPERATOR, VEHICLE, byAttr, classes, confirmationOf, elements, expected, fixture, mockCase, moneyText, norm, parseHtml, parseMoney, paymentPropsOf, quoteOf, reviewCartOf, textOf } from '../fees/fixtures';

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
  return renderToStaticMarkup(await TeamStorefrontRoute({ params: { operatorSlug: OPERATOR.slug }, searchParams: {} }));
}
const flow = () => renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE }));

// ---- MP-26's card readers, copied verbatim from tests/fees/fees.surfaces.test.tsx:141-205 ----------

type Surface = 'review' | 'payment' | 'paid' | 'mock';

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

function parityProblems(label: string, html: string, c: Case, s: Surface): string[] {
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

// ---- AC11 ---------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
/** AC11 engine: problems with one flag-off cart (all integer cents, protection 0, exotiq = platform, grand = operator + exotiq). */
function engineProblems(label: string, cart: BookingCart): string[] {
  const t = cart.totals; const p: string[] = [];
  if (cart.protection !== 'decline') p.push(`${label}: tier ${cart.protection}`);
  if (t.protectionDailyRateCents !== 0 || t.protectionTotalCents !== 0) p.push(`${label}: protection ${t.protectionDailyRateCents}/${t.protectionTotalCents}`);
  if (t.exotiqTotalCents !== t.platformFeeCents) p.push(`${label}: exotiq ${t.exotiqTotalCents} != platform ${t.platformFeeCents}`);
  if (t.grandTotalCents !== t.operatorTotalCents + t.exotiqTotalCents) p.push(`${label}: grand ${t.grandTotalCents} != ${t.operatorTotalCents} + ${t.exotiqTotalCents}`);
  for (const [k, v] of Object.entries(t)) if (k.endsWith('Cents') && !Number.isInteger(v)) p.push(`${label}: ${k} ${v} is not integer cents`);
  return p;
}

const DECLINED = ['FX-T0S0P0', 'FX-T0S1P0', 'FX-T1S0P0', 'FX-T1S1P0'] as const;

describe('MP-30 cent parity with the flag off', () => {
  it('flag-off money keeps cent parity on every surface', async () => {
    env(undefined);
    const problems: string[] = [];
    const seed = Number(process.env.MP30_SEED ?? 20261006);
    console.info(`AC11 seed ${seed}`);

    // Engine: 2,000 seeded carts through the flag-off seed path.
    const mod = await import('@/domain/booking/protect').catch(() => null);
    if (!mod) problems.push('domain/booking/protect.ts is missing');
    else {
      const r = mulberry32(seed);
      for (let i = 0; i < 2000; i++) {
        const rate = int(r, 1, 500_000);
        const days = int(r, 1, 30);
        const pct = int(r, 0, 2500) / 100;
        const base = createInitialCart({ operator: { ...OPERATOR, platformFeePercent: pct }, vehicle: { ...VEHICLE, dailyRateCents: rate, minRentalDays: days } });
        const cart = recomputeBookingCart({ ...base, protection: mod.defaultProtection(), extras: [] });
        const label = `cart ${i} (seed ${seed}: rate ${rate}, days ${days}, fee ${pct}%)`;
        const found = [...engineProblems(`${label} base`, base), ...engineProblems(label, cart)];
        if (cart.totals.days !== days) found.push(`${label}: ${cart.totals.days} days`);
        if (found.length) { problems.push(...found); console.info(`AC11 first failing cart: ${label}`); break; }
      }
    }

    // Surfaces: the four declined fixtures on Review, the payment link and the paid receipt; the mock page's own cart.
    for (const id of DECLINED) {
      const c = fixture(id);
      problems.push(...parityProblems(`review ${id}`, review(c), c, 'review'));
      problems.push(...parityProblems(`payment ${id}`, payment(c), c, 'payment'));
      problems.push(...parityProblems(`paid ${id}`, await confirmation('paid', c), c, 'paid'));
    }
    problems.push(...parityProblems('mock confirmation', await confirmation('mock'), mockCase(false), 'mock'));

    // Planted: a Protect-bearing snapshot with its Protect row cut out is a residual; a premium cart fails the engine check.
    const p1 = fixture('FX-T1S1P1');
    const paid = await confirmation('paid', p1);
    const row = byAttr(parseHtml(paid), 'data-money-line', 'protect')[0];
    expect(row, 'the Protect-bearing receipt has its Protect row').toBeDefined();
    expect(parityProblems('planted', paid.slice(0, row.start) + paid.slice(row.end), p1, 'paid').join('\n')).toContain('lines sum');
    const premium = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
    expect(engineProblems('planted', { ...premium, protection: 'premium', totals: { ...premium.totals, protectionDailyRateCents: 28_900, protectionTotalCents: 86_700 } })).not.toEqual([]);

    expect(problems).toEqual([]);
  });
});
