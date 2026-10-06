// MP-30 AC14 (and, later, AC15): with NEXT_PUBLIC_PROTECT_ENABLED 'true', every Protect surface is
// byte-equal to the base. The goldens are recorded from the branch base (3676b26) BEFORE any source
// edit, by the MP30_RECORD recorder below, and committed alone as the branch's first commit; the
// AC14 test re-checks that provenance from git history. Red on the base by design only where the
// change adds something (cancelNotice); the twelve renders are green at the base by construction.
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
import { createInitialCart } from '@/domain/booking/mockData';
import type { PublicBookingConfirmation } from '@/domain/booking/publicContracts';
import { stripComments } from '../design/lib/scan.mjs';
import { between, literals, sliceFunction } from '../restraint/restraintScan';
import { ACCESS_TOKEN, BOOKING_REF, type Case, NOW_ISO, OPERATOR, VEHICLE, confirmationOf, fixture, paymentPropsOf, quoteOf, reviewCartOf } from '../fees/fixtures';

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

/** The branch base: main after MP-28 (PR #114). */
const BASE_SHA = '3676b261e6e919db4228a139594773d65d5c2ade';
const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url));
const golden = (name: string) => readFileSync(join(GOLDEN_DIR, name), 'utf8');
const git = (...a: string[]) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
/** What "a source edit" means for the recording rule: anything outside tests/. */
const isSource = (p: string) => !p.startsWith('tests/');
const HTML = ['review-FX-T1S1P1.html', 'review-FX-T1S1P0.html', 'review-FX-T1S1P1-requesting.html', 'review-mock-no-quote.html', 'payment-FX-T1S1P1.html', 'payment-FX-T1S1P0.html', 'paid-FX-T1S1P1.html', 'requested-FX-T1S1P1.html', 'mock-confirmation.html', 'storefront-about.html', 'storefront-no-about.html', 'bookingflow-first-render.html'] as const;
type HtmlGolden = (typeof HTML)[number];
async function renders(): Promise<Record<HtmlGolden, string>> {
  const p1 = fixture('FX-T1S1P1');
  const p0 = fixture('FX-T1S1P0');
  return {
    'review-FX-T1S1P1.html': review(p1),
    'review-FX-T1S1P0.html': review(p0),
    'review-FX-T1S1P1-requesting.html': review(p1, { requesting: true }),
    'review-mock-no-quote.html': review(null),
    'payment-FX-T1S1P1.html': payment(p1),
    'payment-FX-T1S1P0.html': payment(p0),
    'paid-FX-T1S1P1.html': await confirmation('paid', p1),
    'requested-FX-T1S1P1.html': await confirmation('requested', p1),
    'mock-confirmation.html': await confirmation('mock'),
    'storefront-about.html': await storefront(true),
    'storefront-no-about.html': await storefront(false),
    'bookingflow-first-render.html': flow(),
  };
}

/** A render against its golden: [] when byte-equal, else the first differing offset with ±60 characters. */
function byteProblems(name: string, got: string, want: string): string[] {
  if (got === want) return [];
  let i = 0;
  while (i < got.length && i < want.length && got[i] === want[i]) i++;
  const at = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 60));
  return [`${name}: differs from the base golden at offset ${i} (got ${got.length} bytes, golden ${want.length}): got ${at(got)} golden ${at(want)}`];
}

describe('MP-30 restoration goldens (recorded from the base)', () => {
  it.skipIf(!process.env.MP30_RECORD)('records the restoration goldens from the base before any source edit (MP30_RECORD, never overwrites)', async () => {
    const committed = lines(git('diff', '--name-only', BASE_SHA, 'HEAD')).filter(isSource);
    const dirty = lines(git('status', '--porcelain')).map((l) => l.slice(3)).filter(isSource);
    expect([...committed, ...dirty], 'goldens are recorded from the unchanged base').toEqual([]);
    expect(existsSync(join(GOLDEN_DIR, 'base.json')), 'base.json exists: goldens are never overwritten').toBe(false);
    env('true'); // read by nothing at the base; kept so the recorder and AC14 render identically
    const files: Record<string, string> = { ...(await renders()) };
    // No jsdom: the confirming-state sentences are read from the base source, in source order:
    // [free+paid, free+unpaid, passed+paid (the forfeit), passed+unpaid]. The slice starts after the
    // <p> anchor, so its own className string is not read as a sentence.
    const P = '<p className="mt-1 text-body-sm leading-5 text-muted">';
    const sentences = literals(between(stripComments(read('components/drive-exotiq/CancelBookingCard.tsx')), P, '</p>').slice(P.length));
    expect(sentences).toHaveLength(4);
    files['cancel-sentences.json'] = `${JSON.stringify(sentences, null, 1)}\n`;
    files['cancel-paid-forfeit.txt'] = sentences[2];
    mkdirSync(GOLDEN_DIR, { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(GOLDEN_DIR, name), text);
    const base = { recordedOn: BASE_SHA, recordedAt: new Date(vi.getRealSystemTime()).toISOString(), files: Object.fromEntries(Object.entries(files).map(([n, t]) => [n, sha256(t)])) };
    writeFileSync(join(GOLDEN_DIR, 'base.json'), `${JSON.stringify(base, null, 1)}\n`);
  });

  it('with the flag on every Protect surface matches the base golden byte for byte', async () => {
    const problems: string[] = [];

    // Provenance: recorded on the base, unchanged since, and committed alone as the branch's first commit.
    const base = JSON.parse(golden('base.json')) as { recordedOn: string; files: Record<string, string> };
    if (base.recordedOn !== BASE_SHA) problems.push(`base.json recordedOn ${base.recordedOn} is not ${BASE_SHA}`);
    for (const [name, sha] of Object.entries(base.files)) if (sha256(golden(name)) !== sha) problems.push(`${name}: sha256 differs from base.json`);
    const goldenCommit = lines(git('log', '--diff-filter=A', '--format=%H', '--', 'tests/protect/golden/base.json')).pop() ?? '';
    if (!goldenCommit) problems.push('the goldens are not committed');
    else {
      if (git('rev-parse', `${goldenCommit}^`) !== BASE_SHA) problems.push(`golden commit ${goldenCommit.slice(0, 7)}'s parent is not the base: it is not the branch's first commit`);
      const touched = lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', goldenCommit)).filter((p) => !p.startsWith('tests/protect/golden/') && p !== 'tests/protect/protect.restore.test.tsx');
      if (touched.length) problems.push(`golden commit ${goldenCommit.slice(0, 7)} also touches ${JSON.stringify(touched)}`);
      const firstSource = lines(git('rev-list', '--reverse', `${BASE_SHA}..HEAD`)).find((sha) => lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', sha)).some(isSource));
      if (firstSource) {
        if (firstSource === goldenCommit) problems.push('the goldens landed in the same commit as a source edit');
        else try { git('merge-base', '--is-ancestor', goldenCommit, firstSource); } catch { problems.push(`golden commit ${goldenCommit.slice(0, 7)} is not an ancestor of the first source commit ${firstSource.slice(0, 7)}`); }
      }
    }
    try { git('merge-base', '--is-ancestor', BASE_SHA, 'HEAD'); } catch { problems.push('the base is not an ancestor of HEAD'); }

    // Flag 'true': every render, byte for byte.
    env('true');
    const now = await renders();
    for (const name of HTML) problems.push(...byteProblems(name, now[name], golden(name)));
    const { cancelNotice } = (await import('@/components/drive-exotiq/CancelBookingCard')) as { cancelNotice?: (a: { free: boolean; paid: boolean; protection: boolean }) => string };
    if (!cancelNotice) problems.push('cancelNotice is not exported');
    else problems.push(...byteProblems('cancel-paid-forfeit.txt', cancelNotice({ free: false, paid: true, protection: true }), golden('cancel-paid-forfeit.txt')));

    // Flag unset: BookingFlow's first render is unchanged too.
    env(undefined);
    problems.push(...byteProblems('bookingflow-first-render.html (flag unset)', flow(), golden('bookingflow-first-render.html')));

    // Planted: a one-byte change to a flag-on render is reported by the same comparator.
    const g = golden('review-FX-T1S1P1.html');
    expect(byteProblems('planted', g.replace('bg-gold', 'bg-gold/90'), g), 'a one-byte change is caught').toHaveLength(1);

    expect(problems).toEqual([]);
  });
});
