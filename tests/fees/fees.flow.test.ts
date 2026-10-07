// MP-26 AC7, AC8, AC10, AC12: the flow is three steps (Dates, Driver, Review & Request), the step
// count is true for the flow and no other caller wears step chrome (MP-17 AC16), the quote still
// gates the request exactly as before, and analytics are unchanged. Pure helpers are tested directly;
// BookingFlow's wiring is pinned by source (comments stripped) and by react-dom/server renders.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));

import { BookingChrome, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { DatesStep } from '@/components/drive-exotiq/flow/DatesStep';
import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { FLOW_STEPS } from '@/components/drive-exotiq/flow/steps';
import { quoteKey } from '@/domain/booking/quote';
import { stripComments } from '../design/lib/scan.mjs';
import { openTags } from '../restraint/restraintScan';
import { NOW_ISO, OPERATOR, VEHICLE, fixture, parseHtml, elements, classes, norm, textOf, quoteOf, reviewCartOf } from './fixtures';
import { REPO } from './goldens';

const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const src = (rel: string) => stripComments(read(rel));
const FLOW = 'components/drive-exotiq/BookingFlow.tsx';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
const DATES = 'components/drive-exotiq/flow/DatesStep.tsx';
const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const BASE = process.env.MP26_BASE_REF ?? '';
const noop = () => {};
// Props that change in this ticket go through a loose type, so the base and the change both compile.
const Chrome = BookingChrome as unknown as ComponentType<Record<string, unknown>>;
const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;

type Steps = typeof import('@/components/drive-exotiq/flow/steps');
async function steps(): Promise<Steps | null> {
  try {
    return await import('@/components/drive-exotiq/flow/steps');
  } catch {
    return null;
  }
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
  vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
  vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** The renter tree's .ts/.tsx files under app/ and components/, marketplace excluded. */
function renterSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace') walk(rel); } else if (/\.tsx?$/.test(e.name)) out.push(rel);
    }
  };
  walk('app');
  walk('components');
  return out;
}

/** AC7 source findings for BookingFlow.tsx (planted text goes through the same function). */
export function flowSourceProblems(text: string): string[] {
  const problems: string[] = [];
  if (!text.includes('Math.min(value + 1, FLOW_STEPS.length)')) problems.push('next does not cap at FLOW_STEPS.length');
  if (/,\s*4\)/.test(text)) problems.push('a literal step bound ", 4)" remains');
  if (/step\s*===\s*4/.test(text)) problems.push('a "step === 4" branch remains');
  const rendered = Array.from(new Set(Array.from(text.matchAll(/<([A-Z]\w*Step)\b/g), (m) => m[1]))).sort();
  if (JSON.stringify(rendered) !== JSON.stringify(['DatesStep', 'DriverStep', 'ReviewStep'])) problems.push(`renders ${rendered.join(', ')}`);
  const review = openTags(text, 'ReviewStep');
  if (review.length !== 1 || !review[0].includes('onRequest={reserve}')) problems.push('ReviewStep is not rendered with onRequest={reserve}');
  if (/\bPayStep\b/.test(text)) problems.push('PayStep is still referenced');
  return problems;
}

/** AC16: the labelled items of a rendered flow progress, or null when there is none. */
function progressItems(html: string): { label: string; state?: string; current: boolean }[] | null {
  const nav = elements(parseHtml(html)).find((e) => e.tag === 'nav' && e.attrs['data-chrome'] === 'progress');
  return nav ? elements(nav).filter((e) => e.tag === 'li').map((li) => ({ label: norm(textOf(li)), state: li.attrs['data-state'], current: li.attrs['aria-current'] === 'step' })) : null;
}
/** AC16: any step chrome in a render: a progress, a bar of the old strip, a numbered counter. */
function stepChrome(html: string): string[] {
  const root = parseHtml(html);
  const found: string[] = [];
  if (progressItems(html) !== null) found.push('a progress');
  if (elements(root).some((e) => classes(e).includes('h-[3px]'))) found.push('a step bar');
  if (/\b0?\d\s*\/\s*0?\d\b/.test(norm(textOf(root)))) found.push('a step counter');
  return found;
}
/** The StepHeader eyebrow text of a rendered step. */
function eyebrowText(html: string): string | undefined {
  const header = elements(parseHtml(html)).find((e) => e.tag === 'div' && classes(e).join(' ') === 'mb-4');
  const first = header?.children.find((c) => typeof c !== 'string');
  return first && typeof first !== 'string' ? norm(textOf(first)) : undefined;
}

describe('MP-26 flow: three steps (AC7, AC8, AC10, AC12)', () => {
  it('the flow has three steps and no pay step remains', async () => {
    const problems: string[] = [];
    const s = await steps();
    if (!s) problems.push('components/drive-exotiq/flow/steps.ts does not exist');
    else {
      if (JSON.stringify(s.FLOW_STEPS.map((x) => x.key)) !== JSON.stringify(['dates', 'driver', 'review'])) problems.push(`FLOW_STEPS keys ${s.FLOW_STEPS.map((x) => x.key).join(',')}`);
      if (JSON.stringify(s.FLOW_STEPS.map((x) => x.label)) !== JSON.stringify(['Dates', 'Driver', 'Review'])) problems.push(`FLOW_STEPS labels ${s.FLOW_STEPS.map((x) => x.label).join(',')}`);
      if (s.COMMIT_STEP !== 3 || s.COMMIT_STEP !== s.FLOW_STEPS.length) problems.push(`COMMIT_STEP ${s.COMMIT_STEP}, FLOW_STEPS.length ${s.FLOW_STEPS.length}`);
    }
    problems.push(...flowSourceProblems(src(FLOW)));
    if (existsSync(join(REPO, 'components/drive-exotiq/flow/PayStep.tsx'))) problems.push('flow/PayStep.tsx still exists');
    for (const rel of renterSources()) if (/\bPayStep\b/.test(read(rel))) problems.push(`${rel}: references PayStep`);

    // Mock mode opens on Dates.
    const html = renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE }));
    const h1 = elements(parseHtml(html)).filter((e) => e.tag === 'h1').map((e) => norm(textOf(e)));
    if (JSON.stringify(h1) !== JSON.stringify(['When are you driving?'])) problems.push(`BookingFlow opens on ${h1.join('|')}`);

    // Planted: each regression is caught by the same source check.
    const good = 'const next = () => setStep((value) => Math.min(value + 1, FLOW_STEPS.length));\n{step === 1 && <DatesStep />}{step === 2 && <DriverStep />}{step === 3 && <ReviewStep onRequest={reserve} />}';
    expect(flowSourceProblems(good)).toEqual([]);
    expect(flowSourceProblems(good.replace('FLOW_STEPS.length))', '4))'))).toHaveLength(2);
    expect(flowSourceProblems(`${good}{step === 4 && <PayStep />}`)).toHaveLength(3);
    expect(flowSourceProblems(good.replace(' onRequest={reserve}', ''))).toEqual(['ReviewStep is not rendered with onRequest={reserve}']);

    expect(problems).toEqual([]);
  });

  it("the flow's progress names three steps and no other caller wears step chrome", async () => {
    const problems: string[] = [];
    const s = await steps();
    if (!s) problems.push('components/drive-exotiq/flow/steps.ts does not exist');
    else for (const n of [1, 2, 3]) if (s.stepEyebrow(n) !== `Step ${n} of 3`) problems.push(`stepEyebrow(${n}) = "${s.stepEyebrow(n)}"`);

    // The flow's chrome: a named progress of the FLOW_STEPS labels, the steps before n done, n current.
    for (const n of [1, 2, 3]) {
      const items = progressItems(renderToStaticMarkup(createElement(Chrome, { step: n }, createElement('p', null, 'x'))));
      const want = FLOW_STEPS.map((st, i) => ({ label: st.label, state: i + 1 < n ? 'done' : i + 1 === n ? 'current' : 'upcoming', current: i + 1 === n }));
      if (JSON.stringify(items) !== JSON.stringify(want)) problems.push(`BookingChrome step=${n}: ${JSON.stringify(items)}`);
    }
    const flow = src(FLOW);
    const chrome = openTags(flow, 'BookingChrome')[0] ?? '';
    if (!chrome.includes('step={step}') || /\bstepTotal\b/.test(chrome)) problems.push(`BookingFlow chrome: ${chrome}`);
    if (/step=\{step \+ 1\}/.test(flow)) problems.push('BookingFlow still hands step + 1 to the chrome');

    // No other caller wears step chrome: not the confirmation's panel, not the page layout, and no
    // caller passes a step, a step style or a total.
    const noStep = stepChrome(renderToStaticMarkup(createElement(PhoneViewport, { layout: 'panel', children: createElement('p', null, 'x') })));
    if (noStep.length) problems.push(`a panel without a step renders ${noStep.join(', ')}`);
    const page = stepChrome(renderToStaticMarkup(createElement(PhoneViewport, { layout: 'page', step: 1, children: createElement('p', null, 'x') })));
    if (page.length) problems.push(`the page layout renders ${page.join(', ')}`);
    for (const rel of ['components/drive-exotiq/ConfirmationScreen.tsx', 'components/drive-exotiq/VehicleEntryPage.tsx', 'app/[operatorSlug]/page.tsx', 'app/not-found.tsx', 'app/booking/[bookingId]/not-found.tsx']) {
      for (const tag of openTags(src(rel), 'PhoneViewport')) if (/\b(step|stepStyle|stepTotal)=/.test(tag)) problems.push(`${rel}: ${tag} wears step chrome`);
    }

    // Eyebrows: rendered and in source; no literal "Step 0n" left in flow/*.tsx.
    const cart = reviewCartOf(fixture('FX-T1S1P1'));
    const q = quoteOf(fixture('FX-T1S1P1'));
    const rendered: [string, string | undefined, string][] = [
      ['DatesStep', eyebrowText(renderToStaticMarkup(createElement(DatesStep, { cart, setCart: noop, next: noop }))), 'Step 1 of 3'],
      ['DriverStep', eyebrowText(renderToStaticMarkup(createElement(DriverStep, { cart, setCart: noop, next: noop }))), 'Step 2 of 3'],
      ['ReviewStep', eyebrowText(renderToStaticMarkup(createElement(Review, { cart, goTo: noop, onRequest: noop, quote: q, onProtectionChange: noop }))), 'Step 3 of 3'],
      ['ReviewStep blocked', eyebrowText(renderToStaticMarkup(createElement(Review, { cart, goTo: noop, onRequest: noop, quote: null, blocked: true, quotePending: true }))), 'Step 3 of 3'],
    ];
    for (const [label, got, want] of rendered) if (got !== want) problems.push(`${label} eyebrow "${got}", expected "${want}"`);
    for (const [rel, n] of [[DATES, 1], [DRIVER, 2]] as const) if (!src(rel).includes(`eyebrow={stepEyebrow(${n})}`)) problems.push(`${rel}: eyebrow not from stepEyebrow(${n})`);
    const headers = openTags(src(REVIEW), 'StepHeader');
    if (headers.length !== 2 || headers.some((t) => !t.includes('eyebrow={stepEyebrow(3)}'))) problems.push(`ReviewStep StepHeaders: ${headers.join(' | ')}`);
    const flowDir = 'components/drive-exotiq/flow';
    for (const f of readdirSync(join(REPO, flowDir)).filter((f) => f.endsWith('.tsx'))) if (/Step 0\d/.test(src(`${flowDir}/${f}`))) problems.push(`${flowDir}/${f}: a literal "Step 0n" eyebrow`);

    // Planted: a progress is read item by item, the old strip and counter are caught, and a step + 1 hand-off is caught.
    expect(progressItems('<nav data-chrome="progress"><ol><li data-state="current" aria-current="step">Dates</li></ol></nav>')).toEqual([{ label: 'Dates', state: 'current', current: true }]);
    expect(progressItems('<div>none</div>')).toBeNull();
    expect(stepChrome('<div class="flex justify-center gap-1"><span class="h-[3px] w-8"></span></div><div><b>01</b><span> / 06</span></div>')).toEqual(['a step bar', 'a step counter']);
    expect(/step=\{step \+ 1\}/.test('<BookingChrome step={step + 1} />')).toBe(true);

    expect(problems).toEqual([]);
  });

  it('the quote gates the request exactly as before', async () => {
    const problems: string[] = [];
    const s = await steps();
    const key = 'team|car|2026-11-10|2026-11-13|premium';
    const other = 'team|car|2026-11-10|2026-11-13|decline';
    if (!s) problems.push('components/drive-exotiq/flow/steps.ts does not exist');
    else {
      const q = { ...quoteOf(fixture('FX-T1S1P1')) };
      const table: [string, Parameters<Steps['shouldRequestQuote']>[0], boolean][] = [
        ['step 1', { step: 1, enabled: true, state: { status: 'idle' }, currentKey: key }, false],
        ['step 2', { step: 2, enabled: true, state: { status: 'idle' }, currentKey: key }, false],
        ['quoting disabled', { step: 3, enabled: false, state: { status: 'idle' }, currentKey: key }, false],
        ['step 3 idle', { step: 3, enabled: true, state: { status: 'idle' }, currentKey: key }, true],
        ['loading, same key', { step: 3, enabled: true, state: { status: 'loading', key }, currentKey: key }, false],
        ['ready, same key', { step: 3, enabled: true, state: { status: 'ready', key, quote: q }, currentKey: key }, false],
        ['ready, key changed (T-12 toggle)', { step: 3, enabled: true, state: { status: 'ready', key: other, quote: q }, currentKey: key }, true],
        ['loading, key changed', { step: 3, enabled: true, state: { status: 'loading', key: other }, currentKey: key }, true],
        ['error, same key (no retry loop)', { step: 3, enabled: true, state: { status: 'error', key, message: 'x' }, currentKey: key }, false],
        ['error, key changed', { step: 3, enabled: true, state: { status: 'error', key: other, message: 'x' }, currentKey: key }, true],
      ];
      for (const [label, args, want] of table) if (s.shouldRequestQuote(args) !== want) problems.push(`shouldRequestQuote ${label}: ${!want}`);
      const btn: [string, Parameters<Steps['requestButtonState']>[0], { label: string; inert: boolean }][] = [
        ['requesting', { blocked: false, pending: false, termsAccepted: true, requesting: true }, { label: 'Sending request…', inert: true }],
        ['blocked + pending', { blocked: true, pending: true, termsAccepted: true, requesting: false }, { label: 'Getting final pricing…', inert: true }],
        ['blocked', { blocked: true, pending: false, termsAccepted: true, requesting: false }, { label: 'Request this booking', inert: true }],
        ['terms unticked', { blocked: false, pending: false, termsAccepted: false, requesting: false }, { label: 'Request this booking', inert: true }],
        ['ready', { blocked: false, pending: false, termsAccepted: true, requesting: false }, { label: 'Request this booking', inert: false }],
      ];
      for (const [label, args, want] of btn) if (JSON.stringify(s.requestButtonState(args)) !== JSON.stringify(want)) problems.push(`requestButtonState ${label}: ${JSON.stringify(s.requestButtonState(args))}`);
    }

    // Blocked (live mode before the quote arrives): the notice, no figure, no card, an inert button.
    const cart = reviewCartOf(fixture('FX-T1S1P1'));
    for (const [label, extra] of [['pending', { quotePending: true }], ['failed', { quoteError: 'We could not confirm final pricing.', onRetryQuote: noop }]] as const) {
      const html = renderToStaticMarkup(createElement(Review, { cart, goTo: noop, onRequest: noop, quote: null, blocked: true, ...extra }));
      const root = parseHtml(html);
      const text = norm(textOf(root));
      if (/\$\d/.test(text)) problems.push(`blocked ${label}: a $ figure is shown`);
      if (html.includes('data-money')) problems.push(`blocked ${label}: the money card renders`);
      if (label === 'pending' && !text.includes('Confirming final pricing…')) problems.push('blocked pending: no QuoteNotice');
      if (label === 'failed' && !text.includes('Try again')) problems.push('blocked failed: no retry');
      const buttons = elements(root).filter((e) => e.tag === 'button' && classes(e).includes('w-full'));
      const cta = buttons[buttons.length - 1];
      if (!cta || !('disabled' in cta.attrs || cta.attrs['aria-disabled'] === 'true')) problems.push(`blocked ${label}: the request button is not inert`);
      if (cta && norm(textOf(cta)) !== (label === 'pending' ? 'Getting final pricing…' : 'Request this booking')) problems.push(`blocked ${label}: button "${cta ? norm(textOf(cta)) : ''}"`);
    }
    // The terms box starts unticked, so a ready quote still renders an inert button; in flight it says so.
    for (const [label, extra, want] of [['ready, terms unticked', {}, 'Request this booking'], ['requesting', { requesting: true }, 'Sending request…']] as const) {
      const root = parseHtml(renderToStaticMarkup(createElement(Review, { cart, goTo: noop, onRequest: noop, quote: quoteOf(fixture('FX-T1S1P1')), onProtectionChange: noop, ...extra })));
      const buttons = elements(root).filter((e) => e.tag === 'button' && classes(e).includes('w-full'));
      const cta = buttons[buttons.length - 1];
      if (!cta || norm(textOf(cta)) !== want || !('disabled' in cta.attrs || cta.attrs['aria-disabled'] === 'true')) problems.push(`${label}: button "${cta ? norm(textOf(cta)) : ''}" ${cta && 'disabled' in cta.attrs ? 'inert' : 'ACTIVE'}`);
    }
    if (!src(REVIEW).includes('requestButtonState(')) problems.push('ReviewStep does not take its button state from requestButtonState');

    // quoteKey carries the tier, so the T-12 toggle invalidates the quote.
    if (quoteKey(reviewCartOf(fixture('FX-T1S1P1'))) === quoteKey(reviewCartOf(fixture('FX-T1S1P0')))) problems.push('quoteKey ignores the protection tier');

    // Source pins in BookingFlow: unchanged commit path, the effect through the helper.
    const flow = src(FLOW);
    for (const pin of [
      'const quoteBlocking = quotingEnabled() && !quote;',
      'onProtectionChange={(tier) => setCart(recomputeBookingCart({ ...cart, protection: tier }))}',
      'if (reserving) return;',
      'if (!shouldRequestQuote({ step, enabled: quotingEnabled(), state: quoteState, currentKey })) return;',
      'void refreshQuote();',
      '}, [step, currentKey, quoteState, refreshQuote]);',
    ]) if (!flow.includes(pin)) problems.push(`BookingFlow: missing ${pin}`);
    if (/step\s*<\s*[34]\b/.test(flow)) problems.push('BookingFlow: a literal quote threshold remains (use shouldRequestQuote)');

    expect(problems).toEqual([]);
  });

  it('analytics calls and book_step values are unchanged', () => {
    const problems: string[] = [];
    const flow = src(FLOW);
    const effect = "useEffect(() => {\n    if (step > 1) track('book_step', { step, team: operator.slug, vehicle: vehicle.slug });\n  }, [step, operator.slug, vehicle.slug]);";
    if (!flow.includes(effect)) problems.push('the book_step effect changed');
    if ((flow.match(/book_step/g) ?? []).length !== 1) problems.push('book_step is emitted from more than one place');
    for (const reach of [/setStep\(\s*4\s*\)/, /goTo\(\s*4\s*\)/, /step\s*===\s*4/, /Math\.min\([^)]*,\s*4\)/]) if (reach.test(flow)) problems.push(`a step value of 4 is reachable: ${reach.source}`);
    const created = flow.indexOf("track('booking_created', { booking: result.bookingRef, team: operator.slug, vehicle: vehicle.slug });");
    const capture = flow.indexOf('captureBooking(');
    const assign = flow.indexOf('window.location.assign(');
    if (!(created >= 0 && capture > created && assign > capture)) problems.push(`order booking_created ${created} < captureBooking ${capture} < assign ${assign} broken`);
    const names = Array.from(new Set(Array.from(flow.matchAll(/track\('([a-z_]+)'/g), (m) => m[1]))).sort();
    if (JSON.stringify(names) !== JSON.stringify(['book_step', 'booking_created'])) problems.push(`event names ${names.join(',')}`);
    const events = /export const EVENTS = (\[[^\]]*\])/.exec(read('components/analytics/policy.ts'))?.[1];
    if (events !== "['browse_view', 'storefront_view', 'vehicle_view', 'book_start', 'book_step', 'booking_created', 'confirmation_view', 'favourite_added', 'capture_start', 'capture_sent', 'alert_created', 'saved_view', 'booking_request_failed', 'checkout_started']") problems.push(`EVENTS changed: ${events}`);

    // The no-diff check under components/analytics/ and docs/analytics/ (positive control always on).
    const analyticsPaths = (paths: string[]) => paths.filter((p) => p.startsWith('components/analytics/') || p.startsWith('docs/analytics/'));
    expect(analyticsPaths(['components/analytics/policy.ts', 'components/drive-exotiq/BookingFlow.tsx', 'docs/analytics/x.md'])).toEqual(['components/analytics/policy.ts', 'docs/analytics/x.md']);
    if (BASE) {
      const changed = execFileSync('git', ['diff', '--name-only', BASE, '--', 'components/analytics', 'docs/analytics'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
      problems.push(...analyticsPaths(changed).map((p) => `${p}: changed since ${BASE}`));
    }

    // Planted: an emitted step 4 and a reordered assign are caught.
    expect(/setStep\(\s*4\s*\)/.test('setStep(4)')).toBe(true);
    expect(problems).toEqual([]);
  });
});
