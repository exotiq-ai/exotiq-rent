// MP-30 AC2, AC3, AC4, AC12: the flag on the wire. Carts start declined while Protect is off; both
// request bodies carry an explicit 'decline' (both backend endpoints treat a missing tier as
// premium, so an omitted key would buy it); a flag-off quote that still charges Protect blocks the
// request (keyed on the total only); and the quote state machine and commit path do not move.
// Red on the base by design. The base-diff part of AC12 runs only with MP30_BASE_REF.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
// BookingFlow seeds its cart through recomputeBookingCart: record what the seed produced, unchanged.
const rec = vi.hoisted(() => ({ recompute: [] as { protection: string; protectionTotalCents: number; protectionDailyRateCents: number }[] }));
vi.mock('@/components/drive-exotiq/flow/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/drive-exotiq/flow/state')>();
  return {
    ...actual,
    recomputeBookingCart: (cart: Parameters<typeof actual.recomputeBookingCart>[0]) => {
      const out = actual.recomputeBookingCart(cart);
      rec.recompute.push({ protection: out.protection, protectionTotalCents: out.totals.protectionTotalCents, protectionDailyRateCents: out.totals.protectionDailyRateCents });
      return out;
    },
  };
});

import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { adaptQuote } from '@/domain/booking/adapters';
import { createInitialCart } from '@/domain/booking/mockData';
import { QuoteUnavailableError, loadQuote, quoteKey } from '@/domain/booking/quote';
import type { RpcQuoteRow } from '@/domain/booking/rpcClient';
import { createBookingCart } from '@/domain/booking/service';
import { createSupabaseRenterBooking } from '@/domain/booking/supabaseService';
import { calculateBookingTotals } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { stripComments } from '../design/lib/scan.mjs';
import { type Case, NOW_ISO, OPERATOR, VEHICLE, elements, fixture, norm, parseHtml, quoteOf, reviewCartOf, textOf } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const BASE = process.env.MP30_BASE_REF ?? '';
const git = (...a: string[]) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const noop = () => {};
const BASE_ENV: Record<string, string> = { NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE: 'mock', NEXT_PUBLIC_RENTER_CAPTURE: 'on', NEXT_PUBLIC_MARKETPLACE_BROWSE: 'off', NEXT_PUBLIC_SITE_MODE: 'booking' };
/** One case's environment, whatever the ambient env says: the harness values, then the flag (undefined = unset). */
function env(flag: string | undefined, extra: Record<string, string> = {}): void {
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...extra })) vi.stubEnv(k, v);
  vi.stubEnv('NEXT_PUBLIC_PROTECT_ENABLED', flag);
}
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW_ISO)); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rec.recompute.length = 0; });
afterAll(() => { vi.useRealTimers(); });

const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;
const FLOW = 'components/drive-exotiq/BookingFlow.tsx';
const QUOTE = 'domain/booking/quote.ts';
const QUOTE_MESSAGE = "We couldn't confirm final pricing. Please try again.";

const SUPA = { NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE: 'supabase', NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key' };
function rowOf(c: Case, over: Partial<RpcQuoteRow> = {}): RpcQuoteRow {
  return {
    currency: 'usd', rental_days: c.days, daily_rate_cents: c.dailyRateCents, rental_subtotal_cents: c.rentalCents, deposit_cents: 0,
    operator_total_cents: c.operatorTotalCents, platform_fee_percent: 10, platform_fee_cents: c.platformFeeCents,
    protection_tier: c.protect ? 'premium' : 'decline', protection_daily_cents: c.protectionDailyRateCents, protection_total_cents: c.protectionTotalCents,
    processing_fee_cents: c.processingFeeCents, operator_tax_rate: c.taxCents > 0 ? c.taxPct : undefined, operator_tax_label: c.taxLabel, operator_tax_cents: c.taxCents,
    state_fee_cents: c.stateFeeCents, state_fee_label: c.stateFeeLabel, exotiq_total_cents: c.exotiqTotalCents, grand_total_cents: c.grandTotalCents, ...over,
  };
}
/** Both request bodies for one cart, exactly as fetch received them (JSON strings). */
async function requestBodies(cart: BookingCart, flag: string | undefined, row: RpcQuoteRow = rowOf(fixture('FX-T1S1P0'))) {
  env(flag, SUPA);
  const sent: { url: string; body: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    sent.push({ url: String(url), body: String(init?.body ?? '') });
    const payload = String(url).includes('/rest/v1/rpc/public_vehicle_quote') ? [row] : { booking_ref: 'BK-90001', confirmation_token: 'tok-BK-90001', status: 'requested', identity_verified: false };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  try {
    await loadQuote(cart).catch(() => undefined);
    // Explicit checked fixture evidence: a wire-format test must not encode
    // an absent availability observation as permission to create a live request.
    await createSupabaseRenterBooking({ ...cart, vehicle: { ...cart.vehicle, unavailableRanges: [], availabilityAuthority: { status: 'KNOWN', checkedAt: new Date().toISOString(), windowStart: cart.dates.start, windowEnd: cart.dates.end } } });
  } finally { vi.unstubAllGlobals(); }
  return { quote: sent.find((s) => s.url.includes('/rest/v1/rpc/public_vehicle_quote'))?.body, create: sent.find((s) => s.url.includes('/functions/v1/rent-create-booking'))?.body };
}
/** Today's two body shapes, built by hand in the code's key order (rpcClient.ts:218-224; supabaseService.ts:101-113). */
const quoteBody = (c: BookingCart, tier: string) => JSON.stringify({ _team_slug: c.operator.slug, _vehicle_slug: c.vehicle.slug, _start_date: c.dates.start, _end_date: c.dates.end, _options: { protection: tier } });
const createBody = (c: BookingCart, tier: string) => JSON.stringify({ team_slug: c.operator.slug, vehicle_slug: c.vehicle.slug, start_date: c.dates.start, end_date: c.dates.end, pickup_time: c.pickupTime, protection: tier, driver: { name: c.driver.name, email: c.driver.email ?? '', phone: c.driver.phone } });
/** AC3: a received body against the expected one; names an omitted key or a wrong tier before a byte mismatch. */
function bodyProblems(label: string, got: string | undefined, want: string, key: '_options' | 'protection'): string[] {
  if (got === undefined) return [`${label}: no request sent`];
  const parsed = JSON.parse(got) as Record<string, unknown>;
  const tier = key === '_options' ? (parsed._options as { protection?: string } | undefined)?.protection : parsed.protection;
  if (tier === undefined) return [`${label}: protection omitted (the backend would charge premium)`];
  return got === want ? [] : [`${label}: ${got} != ${want}`];
}
/** Comment-free, blank-line-free source: what AC12's base comparison compares. */
const code = (s: string) => stripComments(s).split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()).join('\n');

/** AC4: loadQuote against one stubbed quote row, settled. */
async function quoteWith(row: RpcQuoteRow, flag: string | undefined): Promise<{ ok: true; value: unknown } | { ok: false; error: unknown }> {
  env(flag, SUPA);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([row]), { status: 200, headers: { 'content-type': 'application/json' } })));
  try { return { ok: true, value: await loadQuote(reviewCartOf(fixture('FX-T1S1P0'))) }; } catch (error) { return { ok: false, error }; } finally { vi.unstubAllGlobals(); }
}
const rejectsAsGuard = (label: string, r: Awaited<ReturnType<typeof quoteWith>>): string[] =>
  r.ok ? [`${label}: resolved, expected a QuoteUnavailableError`]
    : !(r.error instanceof QuoteUnavailableError) ? [`${label}: rejected with ${String(r.error)}, not a QuoteUnavailableError`]
      : r.error.message !== QUOTE_MESSAGE ? [`${label}: message "${r.error.message}"`] : [];
const resolvesAs = (label: string, r: Awaited<ReturnType<typeof quoteWith>>, row: RpcQuoteRow): string[] =>
  !r.ok ? [`${label}: rejected (${String(r.error)}), expected to resolve`]
    : JSON.stringify(r.value) !== JSON.stringify(adaptQuote(row)) ? [`${label}: resolved to something other than adaptQuote(row)`] : [];

describe('MP-30 the wire', () => {
  it('flag-off carts start declined and flag-on carts start premium', async () => {
    const problems: string[] = [];
    const days = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE }).totals.days;
    /** A cart (or the seed's recorded output) under the flag off: declined, no Protect cents. */
    const offProblems = (label: string, c: { protection: string; protectionDailyRateCents: number; protectionTotalCents: number }) =>
      c.protection !== 'decline' || c.protectionDailyRateCents !== 0 || c.protectionTotalCents !== 0 ? [`${label}: ${JSON.stringify(c)} under the flag off`] : [];
    /** A cart under the flag 'true': premium, totals equal to today's to the cent. */
    const onProblems = (label: string, cart: BookingCart) => {
      const today = { ...cart, protection: 'premium', totals: calculateBookingTotals({ dailyRateCents: VEHICLE.dailyRateCents, startDate: cart.dates.start, endDate: cart.dates.end, extras: cart.extras, protection: 'premium', operatorTaxRate: 0, platformFeeRate: (OPERATOR.platformFeePercent ?? 10) / 100, depositHoldCents: VEHICLE.securityDepositCents }) };
      return JSON.stringify(cart) === JSON.stringify(today) ? [] : [`${label}: ${cart.protection} cart, totals ${JSON.stringify(cart.totals)} != today's ${JSON.stringify(today.totals)}`];
    };
    const flat = (c: BookingCart) => ({ protection: c.protection, protectionDailyRateCents: c.totals.protectionDailyRateCents, protectionTotalCents: c.totals.protectionTotalCents });

    for (const flag of [undefined, 'false']) {
      env(flag);
      problems.push(...offProblems(`createInitialCart (${flag})`, flat(createInitialCart({ operator: OPERATOR, vehicle: VEHICLE }))));
      problems.push(...offProblems(`createBookingCart (${flag})`, flat(createBookingCart({ operator: OPERATOR, vehicle: VEHICLE }))));
      rec.recompute.length = 0;
      renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE }));
      if (!rec.recompute[0]) problems.push(`BookingFlow (${flag}): the seed did not recompute`);
      else problems.push(...offProblems(`BookingFlow seed (${flag})`, rec.recompute[0]));
    }
    env('true');
    problems.push(...onProblems('createInitialCart (true)', createInitialCart({ operator: OPERATOR, vehicle: VEHICLE })));
    problems.push(...onProblems('createBookingCart (true)', createBookingCart({ operator: OPERATOR, vehicle: VEHICLE })));
    rec.recompute.length = 0;
    renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE }));
    if (rec.recompute[0]?.protection !== 'premium' || rec.recompute[0]?.protectionTotalCents !== 28_900 * days) problems.push(`BookingFlow seed (true): ${JSON.stringify(rec.recompute[0])}`);

    // Planted: a premium cart under the flag off, and a flag-on cart one cent off, are reported.
    env('true');
    const premium = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
    expect(offProblems('planted', flat({ ...premium, protection: 'premium' }))).not.toEqual([]);
    expect(onProblems('planted', { ...premium, totals: { ...premium.totals, grandTotalCents: premium.totals.grandTotalCents + 1 } })).not.toEqual([]);

    expect(problems).toEqual([]);
  });

  it('both request bodies carry an explicit decline while the flag is off', async () => {
    const problems: string[] = [];
    const p1 = reviewCartOf(fixture('FX-T1S1P1'));
    const carts: [string, BookingCart][] = [['premium', p1], ['standard', { ...p1, protection: 'standard' }], ['decline', reviewCartOf(fixture('FX-T1S1P0'))]];
    for (const [label, cart] of carts) {
      const off = await requestBodies(cart, undefined);
      problems.push(...bodyProblems(`off ${label} quote`, off.quote, quoteBody(cart, 'decline'), '_options'));
      problems.push(...bodyProblems(`off ${label} create`, off.create, createBody(cart, 'decline'), 'protection'));
      // Today's declined request for the same cart: no new payload variant.
      const declinedOn = await requestBodies({ ...cart, protection: 'decline' }, 'true');
      if (off.quote !== declinedOn.quote) problems.push(`off ${label} quote differs from today's declined quote body`);
      if (off.create !== declinedOn.create) problems.push(`off ${label} create differs from today's declined create body`);
      const on = await requestBodies(cart, 'true');
      problems.push(...bodyProblems(`on ${label} quote`, on.quote, quoteBody(cart, cart.protection), '_options'));
      problems.push(...bodyProblems(`on ${label} create`, on.create, createBody(cart, cart.protection), 'protection'));
    }
    // No other outbound payload gains a protection field.
    const flow = stripComments(read(FLOW)).split('\n').filter((l) => l.includes("track('booking_created'"));
    if (flow.length !== 1 || /protection/.test(flow[0])) problems.push(`booking_created: ${JSON.stringify(flow)}`);
    if (/protection/.test(stripComments(read('components/renters/bookingCapture.ts')))) problems.push('bookingCapture names protection');

    // Planted: an omitted key and a premium tier are reported.
    const d = reviewCartOf(fixture('FX-T1S1P0'));
    expect(bodyProblems('planted', quoteBody(d, 'decline').replace('"_options":{"protection":"decline"}', '"_options":{}'), quoteBody(d, 'decline'), '_options')).toEqual(['planted: protection omitted (the backend would charge premium)']);
    expect(bodyProblems('planted', createBody(d, 'premium'), createBody(d, 'decline'), 'protection')).not.toEqual([]);

    expect(problems).toEqual([]);
  });

  it('a flag-off quote that carries a Protect charge blocks the request', async () => {
    const problems: string[] = [];
    const p1 = fixture('FX-T1S1P1');
    const p0 = fixture('FX-T1S1P0');
    const charged = rowOf(p1);
    if (charged.protection_daily_cents !== 28_900 || charged.protection_total_cents !== 86_700) problems.push(`fixture row ${charged.protection_daily_cents}/${charged.protection_total_cents}`);
    problems.push(...rejectsAsGuard('(a) daily 28,900, total 86,700', await quoteWith(charged, undefined)));
    problems.push(...rejectsAsGuard('(b) daily 0, total 86,700', await quoteWith(rowOf(p1, { protection_daily_cents: 0 }), undefined)));
    const residual = rowOf(p0, { protection_daily_cents: 28_900 });
    problems.push(...resolvesAs('(c) daily 28,900, total 0', await quoteWith(residual, undefined), residual));
    const clean = rowOf(p0);
    problems.push(...resolvesAs('(d) daily 0, total 0', await quoteWith(clean, undefined), clean));
    problems.push(...resolvesAs('(a) under the flag true', await quoteWith(charged, 'true'), charged));

    // The blocked branch: the notice, its retry, and an inert request button.
    env(undefined);
    const html = renderToStaticMarkup(createElement(Review, { cart: reviewCartOf(p0), goTo: noop, onRequest: noop, quote: quoteOf(p0), onProtectionChange: noop, onMarketingConsentChange: noop, blocked: true, quoteError: QUOTE_MESSAGE, onRetryQuote: noop }));
    const els = elements(parseHtml(html));
    if (!els.some((e) => e.tag === 'p' && norm(textOf(e)) === QUOTE_MESSAGE)) problems.push('blocked: the message is not shown');
    if (!els.some((e) => e.tag === 'button' && norm(textOf(e)) === 'Try again')) problems.push('blocked: no Try again button');
    const cta = els.find((e) => e.tag === 'button' && norm(textOf(e)) === 'Request this booking');
    if (!cta || !('disabled' in cta.attrs)) problems.push('blocked: the request button is not disabled');
    // The rejection lands in BookingFlow's existing catch.
    if (!stripComments(read(FLOW)).includes('message: error instanceof QuoteUnavailableError\n          ? error.message\n          : "We couldn\'t confirm final pricing. Please try again.",')) problems.push('BookingFlow: the refreshQuote catch moved');

    expect(problems).toEqual([]);
  });

  it('the protection wire remains explicit with current authority and synchronous request guards', async () => {
    const problems: string[] = [];
    const flow = stripComments(read(FLOW));
    // MP-26's pins (tests/fees/fees.flow.test.ts:255-262), the back guard, the seed and its one import.
    for (const pin of [
      'const quoteBlocking = quotingEnabled() && !quote;',
      'onProtectionChange={(tier) => setCart(recomputeBookingCart({ ...cart, protection: tier }))}',
      'if (requestInFlight.current || !canProceed() || (quotingEnabled() && !latest.current.quote)) return;',
      'if (authorityBlocking || !shouldRequestQuote({ step, enabled: quotingEnabled(), state: quoteState, currentKey })) return;',
      'void refreshQuote();',
      '}, [step, currentKey, quoteState, refreshQuote, authorityBlocking]);',
      'const back = step > 1 && !reserving ? () => setStep((value) => value - 1) : undefined;',
      'protection: defaultProtection(), extras: [] });',
    ]) if (!flow.includes(pin)) problems.push(`BookingFlow: missing ${pin}`);
    const IMPORT = "import { defaultProtection } from '@/domain/booking/protect';";
    if (flow.split(IMPORT).length !== 2) problems.push(`BookingFlow: ${flow.split(IMPORT).length - 1} defaultProtection imports, expected 1`);

    const quote = stripComments(read(QUOTE));
    for (const text of [
      "export function quoteKey(cart: BookingCart): string {\n  return [cart.operator.slug, cart.vehicle.slug, cart.dates.start, cart.dates.end, cart.protection].join('|');\n}",
      'export function isQuotableRange(cart: BookingCart): boolean {\n  return Boolean(cart.dates.start && cart.dates.end && cart.dates.end > cart.dates.start);\n}',
      "export function quotingEnabled(): boolean {\n  return getDataMode() === 'supabase';\n}",
      'export class QuoteUnavailableError extends Error {}',
      "export type QuoteState =\n  | { status: 'idle' }\n  | { status: 'loading'; key: string }\n  | { status: 'ready'; key: string; quote: PublicQuote }\n  | { status: 'error'; key: string; message: string };",
    ]) if (!quote.includes(text)) problems.push(`quote.ts: changed: ${text.split('\n')[0]}`);
    env(undefined);
    const key = quoteKey(createInitialCart({ operator: OPERATOR, vehicle: VEHICLE }));
    if (!key.endsWith('|decline')) problems.push(`flag-off quoteKey ${key}`);

    if (BASE) {
      const now = code(read(FLOW)).replace(`${IMPORT}\n`, '').replace('protection: defaultProtection(), extras: []', "protection: 'premium', extras: []");
      if (now !== code(git('show', `${BASE}:${FLOW}`))) problems.push('BookingFlow differs from the base beyond the seed, its import and comments');
      try { git('diff', '--quiet', BASE, '--', 'components/drive-exotiq/flow/steps.ts'); } catch { problems.push('flow/steps.ts differs from the base'); }
    }

    // Planted: a guard change is a code change; an added comment is not.
    const raw = read(FLOW);
    const guard = 'if (requestInFlight.current || !canProceed() || (quotingEnabled() && !latest.current.quote)) return;';
    expect(code(raw.replace(guard, 'if (requestInFlight.current) return;'))).not.toBe(code(raw));
    expect(code(raw.replace(guard, `${guard} // planted comment`))).toBe(code(raw));

    expect(problems).toEqual([]);
  });
});
