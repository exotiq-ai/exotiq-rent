// MP-26 fixtures (spec "Reference: fixtures"). Not a test file: the tests/fees/*.test.* files
// import it. It lives under tests/, outside Tailwind's content globs and MP-15's budget scan.
//
// Every expected figure here is computed from the fixture constants with the same roundings
// domain/booking/totals.ts uses, never from foldFees: a parity test that checks the fold against
// itself proves nothing.
import { createInitialCart, mockOperators, mockVehicles } from '@/domain/booking/mockData';
import { calculateBookingTotals } from '@/domain/booking/totals';
import type { PublicBookingConfirmation, PublicQuote } from '@/domain/booking/publicContracts';
import type { BookingCart, ProtectionTier } from '@/domain/booking/types';

// ---- constants --------------------------------------------------------------------------------

export const OPERATOR = mockOperators[0];
export const OPERATOR_NAME = OPERATOR.name;
export const VEHICLE = mockVehicles[0];
export const DAYS = 3;
export const DAILY_RATE = 100_000;
export const PLATFORM_RATE = 0.1;
export const PROTECT_DAILY = 28_900;
export const TAX_PCT = 7.5;
export const TAX_LABEL = 'Tax';
export const STATE_DAILY = 500;
export const STATE_LABEL = 'FL rental fee';
export const PROCESSING_ON = 4_137;
export const PROCESSING_OFF = 1_259;
/** Fixed clock and dates: every render is deterministic. */
export const NOW_ISO = '2026-11-01T18:00:00.000Z';
export const START = '2026-11-10';
export const END = '2026-11-13';
export const DUE_ISO = '2026-11-03T06:00:00.000Z';
export const PAID_ISO = '2026-11-02T15:30:00.000Z';
export const BOOKING_REF = 'BK-26026';
export const ACCESS_TOKEN = 'tok_mp26_fixture';

export const OPERATOR_HEADER = (name: string) => `${name} · charged by the operator`;
export const EXOTIQ_HEADER = 'Drive Exotiq · charged separately — appears as EXOTIQ RENT';
export const OLD_STRINGS = ['Exotiq.Rent', 'Charged separately by EXOTIQ.RENT', 'Charge from', 'Exotiq total', 'Protection & fees', 'Protection &amp; fees', 'Trip Fees + protection', 'Operator rental charge'];

// ---- a priced case (one fixture or one grid cell) ------------------------------------------------

export type Case = {
  id: string;
  days: number;
  dailyRateCents: number;
  rentalCents: number;
  taxPct: number;
  taxCents: number;
  taxLabel?: string;
  platformFeeCents: number;
  protect: boolean;
  protectionDailyRateCents: number;
  protectionTotalCents: number;
  stateFeeCents: number;
  stateFeeLabel?: string;
  processingFeeCents: number;
  operatorTotalCents: number;
  exotiqTotalCents: number;
  grandTotalCents: number;
};

/** The canary identities (scripts/canary/renter-canary.ts:181-186). Throws on a quote that breaks them. */
export function assertCanary(q: Pick<Case, 'id' | 'platformFeeCents' | 'protectionTotalCents' | 'stateFeeCents' | 'processingFeeCents' | 'exotiqTotalCents' | 'operatorTotalCents' | 'grandTotalCents'>): void {
  const exotiq = q.platformFeeCents + q.protectionTotalCents + q.stateFeeCents + q.processingFeeCents;
  if (q.exotiqTotalCents !== exotiq) throw new Error(`${q.id}: canary exotiq ${q.exotiqTotalCents} != platform + protection + state + processing ${exotiq}`);
  if (q.grandTotalCents !== q.operatorTotalCents + q.exotiqTotalCents) throw new Error(`${q.id}: canary grand ${q.grandTotalCents} != operator + exotiq ${q.operatorTotalCents + q.exotiqTotalCents}`);
}

/** Build a case with totals.ts's roundings (tax and platform Math.round of the rental), then check it against the canary. */
export function makeCase(p: { id: string; days: number; dailyRateCents: number; taxPct: number; stateDaily: number; processingFeeCents: number; protect: boolean; stateFeeLabel?: string }): Case {
  const rentalCents = p.dailyRateCents * p.days;
  const taxCents = Math.round(rentalCents * (p.taxPct / 100));
  const platformFeeCents = Math.round(rentalCents * PLATFORM_RATE);
  const protectionDailyRateCents = p.protect ? PROTECT_DAILY : 0;
  const protectionTotalCents = protectionDailyRateCents * p.days;
  const stateFeeCents = p.stateDaily * p.days;
  const operatorTotalCents = rentalCents + taxCents;
  const exotiqTotalCents = platformFeeCents + protectionTotalCents + stateFeeCents + p.processingFeeCents;
  const c: Case = {
    id: p.id,
    days: p.days,
    dailyRateCents: p.dailyRateCents,
    rentalCents,
    taxPct: p.taxPct,
    taxCents,
    taxLabel: taxCents > 0 ? TAX_LABEL : undefined,
    platformFeeCents,
    protect: p.protect,
    protectionDailyRateCents,
    protectionTotalCents,
    stateFeeCents,
    stateFeeLabel: stateFeeCents > 0 ? p.stateFeeLabel ?? STATE_LABEL : undefined,
    processingFeeCents: p.processingFeeCents,
    operatorTotalCents,
    exotiqTotalCents,
    grandTotalCents: operatorTotalCents + exotiqTotalCents,
  };
  assertCanary(c);
  return c;
}

// ---- the eight fixtures FX-T{0|1}S{0|1}P{0|1} -----------------------------------------------------

export const FIXTURE_IDS = ['FX-T0S0P0', 'FX-T0S0P1', 'FX-T0S1P0', 'FX-T0S1P1', 'FX-T1S0P0', 'FX-T1S0P1', 'FX-T1S1P0', 'FX-T1S1P1'] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

export function fixture(id: FixtureId): Case {
  const [, t, s, p] = /^FX-T(\d)S(\d)P(\d)$/.exec(id)!.map(Number);
  return makeCase({
    id,
    days: DAYS,
    dailyRateCents: DAILY_RATE,
    taxPct: t ? TAX_PCT : 0,
    stateDaily: s ? STATE_DAILY : 0,
    processingFeeCents: p ? PROCESSING_ON : PROCESSING_OFF,
    protect: Boolean(p),
  });
}
export const fixtures = (): Case[] => FIXTURE_IDS.map(fixture);

// ---- the parity grid (2,160 cases) and its 64-case sample ---------------------------------------

export const GRID_RATES = [99_900, 119_900, 133_333];
export const GRID_TAX = [0, 7.5, 7.8];
export const GRID_STATE = [0, 500];
export const GRID_PROCESSING = [0, 4_137];

export function grid(): Case[] {
  const out: Case[] = [];
  for (let days = 1; days <= 30; days++)
    for (const rate of GRID_RATES)
      for (const tax of GRID_TAX)
        for (const state of GRID_STATE)
          for (const proc of GRID_PROCESSING)
            for (const protect of [true, false])
              out.push(makeCase({ id: `G-d${days}-r${rate}-t${tax}-s${state}-p${proc}-${protect ? 'on' : 'off'}`, days, dailyRateCents: rate, taxPct: tax, stateDaily: state, processingFeeCents: proc, protect }));
  return out;
}
/** Every 34th grid case from index 0: 64 cases. */
export const sample64 = (all: Case[] = grid()): Case[] => all.filter((_, i) => i % 34 === 0);

// ---- per-surface source shapes ----------------------------------------------------------------

export function quoteOf(c: Case): PublicQuote {
  return {
    currency: 'usd',
    rentalDays: c.days,
    dailyRateCents: c.dailyRateCents,
    rentalSubtotalCents: c.rentalCents,
    extrasSubtotalCents: 0,
    operatorTaxesCents: c.taxCents,
    operatorTaxLabel: c.taxCents > 0 ? TAX_LABEL : undefined,
    operatorTaxRate: c.taxCents > 0 ? c.taxPct : undefined,
    operatorTotalCents: c.operatorTotalCents,
    platformFeeRate: PLATFORM_RATE,
    platformFeeCents: c.platformFeeCents,
    protectionDailyRateCents: c.protectionDailyRateCents,
    protectionTotalCents: c.protectionTotalCents,
    processingFeeCents: c.processingFeeCents,
    stateFeeCents: c.stateFeeCents,
    stateFeeLabel: c.stateFeeLabel,
    exotiqTotalCents: c.exotiqTotalCents,
    grandTotalCents: c.grandTotalCents,
    depositHoldCents: VEHICLE.securityDepositCents,
    cancellationPolicy: { freeCancellationHours: 72, platformFeeRefundableInWindow: true, protectionRefundableInWindow: true },
  };
}

/** The Review cart: the mock operator, the fixture's rate, fixed dates, the fixture's protection tier. */
export function reviewCartOf(c: Pick<Case, 'days' | 'dailyRateCents' | 'protect'>): BookingCart {
  const base = createInitialCart({ operator: OPERATOR, vehicle: { ...VEHICLE, dailyRateCents: c.dailyRateCents } });
  const end = new Date(`${START}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + c.days);
  const dates = { start: START, end: end.toISOString().slice(0, 10) };
  const protection: ProtectionTier = c.protect ? 'premium' : 'decline';
  return {
    ...base,
    dates,
    protection,
    extras: [],
    totals: calculateBookingTotals({ dailyRateCents: c.dailyRateCents, startDate: dates.start, endDate: dates.end, extras: [], protection, operatorTaxRate: 0, platformFeeRate: PLATFORM_RATE, depositHoldCents: VEHICLE.securityDepositCents }),
  };
}

export function paymentPropsOf(c: Case) {
  return {
    bookingRef: BOOKING_REF,
    accessToken: ACCESS_TOKEN,
    dueAtIso: DUE_ISO,
    rentalCents: c.operatorTotalCents,
    platformFeeCents: c.platformFeeCents,
    protectionTotalCents: c.protectionTotalCents,
    stateFeeCents: c.stateFeeCents,
    processingFeeCents: c.processingFeeCents,
    operatorTaxCents: c.taxCents,
    operatorTaxLabel: c.taxLabel,
    operatorName: OPERATOR_NAME,
  };
}

type Live = NonNullable<PublicBookingConfirmation['live']>;
/** `live` for the payment link (pending_payment, due in the future) or the paid receipt (paidAt set). */
export function liveOf(c: Case, kind: 'payment' | 'paid'): Live {
  return {
    status: kind === 'payment' ? 'pending_payment' : 'confirmed',
    startAt: `${START}T17:00:00.000Z`,
    endAt: `${END}T17:00:00.000Z`,
    totalCents: c.operatorTotalCents,
    paymentDueAt: kind === 'payment' ? DUE_ISO : undefined,
    paidAt: kind === 'paid' ? PAID_ISO : undefined,
    protectionTier: c.protect ? 'premium' : 'decline',
    platformFeeCents: c.platformFeeCents,
    protectionTotalCents: c.protectionTotalCents,
    stateFeeCents: c.stateFeeCents,
    processingFeeCents: c.processingFeeCents,
    operatorTaxCents: c.taxCents,
    operatorTaxLabel: c.taxLabel,
    timezone: OPERATOR.timezone,
    supportEmail: 'desk@example.com',
    pickupAddress: '7014 E Camelback Rd, Scottsdale, AZ',
  };
}

export function confirmationOf(c: Case, kind: 'payment' | 'paid'): PublicBookingConfirmation {
  return { bookingRef: BOOKING_REF, team: OPERATOR, vehicle: VEHICLE, live: liveOf(c, kind) };
}

/** The mock confirmation cart (createBookingCart's own: tax 0, no state fee, no processing), Protect on or off. */
export function mockCart(protect: boolean): BookingCart {
  const base = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
  const protection: ProtectionTier = protect ? 'premium' : 'decline';
  return { ...base, protection, totals: calculateBookingTotals({ dailyRateCents: VEHICLE.dailyRateCents, startDate: base.dates.start, endDate: base.dates.end, extras: [], protection, operatorTaxRate: 0, platformFeeRate: (OPERATOR.platformFeePercent ?? 10) / 100, depositHoldCents: VEHICLE.securityDepositCents }) };
}
/** The mock surface's case, from the constants (the mock vehicle's own rate and minimum stay). */
export const mockCase = (protect: boolean): Case =>
  makeCase({ id: `MOCK-P${protect ? 1 : 0}`, days: VEHICLE.minRentalDays, dailyRateCents: VEHICLE.dailyRateCents, taxPct: 0, stateDaily: 0, processingFeeCents: 0, protect });

/** The fold input for a case as the Review surface supplies it (days, rate, percent, labels known). */
export function foldInputOf(c: Case, known = true) {
  return {
    operatorName: OPERATOR_NAME,
    operatorTotalCents: c.operatorTotalCents,
    operatorTaxCents: c.taxCents,
    operatorTaxLabel: c.taxCents > 0 ? TAX_LABEL : undefined,
    operatorTaxRate: known && c.taxCents > 0 ? c.taxPct : undefined,
    days: known ? c.days : undefined,
    dailyRateCents: known ? c.dailyRateCents : undefined,
    platformFeeCents: c.platformFeeCents,
    platformFeePercent: known ? 10 : undefined,
    protectionTotalCents: c.protectionTotalCents,
    stateFeeCents: c.stateFeeCents,
    stateFeeLabel: known ? c.stateFeeLabel : undefined,
    processingFeeCents: c.processingFeeCents,
    exotiqTotalCents: c.exotiqTotalCents,
  };
}

// ---- expected rows -----------------------------------------------------------------------------

export type Expected = {
  operator: { line: string; cents: number }[];
  operatorSubtotal: number;
  exotiq: { line: string; cents: number }[];
  exotiqSubtotal: number;
  tripFees: number;
  total: number;
};
export function expected(c: Case): Expected {
  const operator = [{ line: 'rental', cents: c.rentalCents }];
  if (c.taxCents > 0) operator.push({ line: 'operator-tax', cents: c.taxCents });
  const exotiq: { line: string; cents: number }[] = [];
  if (c.protectionTotalCents > 0) exotiq.push({ line: 'protect', cents: c.protectionTotalCents });
  exotiq.push({ line: 'trip-fees', cents: c.platformFeeCents + c.stateFeeCents });
  if (c.processingFeeCents > 0) exotiq.push({ line: 'processing', cents: c.processingFeeCents });
  return { operator, operatorSubtotal: c.operatorTotalCents, exotiq, exotiqSubtotal: c.exotiqTotalCents, tripFees: c.platformFeeCents + c.stateFeeCents, total: c.grandTotalCents };
}

// ---- money text ---------------------------------------------------------------------------------

/** "$1,223.37" -> 122337 (string arithmetic, no float). */
export function parseMoney(text: string): number {
  const m = /^-?\$([\d,]+)(?:\.(\d{2}))?$/.exec(text.trim());
  if (!m) throw new Error(`not a money amount: "${text}"`);
  return Number(m[1].replace(/,/g, '')) * 100 + Number(m[2] ?? '0');
}
/** The statement-parity rendering, re-implemented here: whole dollars clean, otherwise two decimals. */
export function moneyText(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
}
export const MONEY_RE = /\$[\d,]+(?:\.\d{2})?/g;
export const amountsIn = (text: string): number[] => (text.match(MONEY_RE) ?? []).map(parseMoney);

// ---- an element tree of server-rendered markup (offsets kept, so a subtree slices byte-exact) ----

export type El = {
  tag: string;
  attrs: Record<string, string>;
  children: (El | string)[];
  parent: El | null;
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
};
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'col', 'embed', 'wbr']);
export const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

export function parseHtml(html: string): El {
  const root: El = { tag: '#root', attrs: {}, children: [], parent: null, start: 0, end: html.length, innerStart: 0, innerEnd: html.length };
  let cur = root;
  let last = 0;
  for (const m of Array.from(html.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g))) {
    const at = m.index ?? 0;
    if (at > last) cur.children.push(decode(html.slice(last, at)));
    last = at + m[0].length;
    const [, close, tag, rawAttrs, self] = m;
    if (close) {
      // Close the nearest open element with this tag.
      let n: El | null = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n) { n.end = last; n.innerEnd = at; cur = n.parent ?? root; }
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of Array.from(rawAttrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g))) attrs[a[1]] = decode(a[2] ?? '');
    const el: El = { tag, attrs, children: [], parent: cur, start: at, end: last, innerStart: last, innerEnd: last };
    cur.children.push(el);
    if (!self && !VOID.has(tag)) cur = el;
  }
  if (last < html.length) cur.children.push(decode(html.slice(last)));
  return root;
}
export const elements = (el: El): El[] => [el, ...el.children.flatMap((c) => (typeof c === 'string' ? [] : elements(c)))];
export const textOf = (el: El): string => el.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
export const classes = (el: El): string[] => (el.attrs.class ?? '').split(/\s+/).filter(Boolean);
export const hasClass = (el: El, ...cls: string[]) => cls.every((c) => classes(el).includes(c));
export const byAttr = (root: El, name: string, value?: string): El[] => elements(root).filter((e) => e !== root && name in e.attrs && (value === undefined || e.attrs[name] === value));
export const byId = (root: El, id: string): El | undefined => elements(root).find((e) => e.attrs.id === id);
export const outer = (html: string, el: El) => html.slice(el.start, el.end);
/** Document order index of an element (for "A before B" checks). */
export const orderOf = (root: El, el: El) => elements(root).indexOf(el);
export const contains = (a: El, b: El): boolean => { for (let n: El | null = b; n; n = n.parent) if (n === a) return true; return false; };
