// MP-25 AC8, AC9, AC12, AC13, AC14: contained overscroll, the "Review" label, the restraint contract,
// the scope fence and the lockstep set. Source scans and react-dom/server against the base recordings in
// tests/polish/golden (made before the first source edit). Computed overscroll, label truncation, cookie-row
// ancestors and the Details dialog are scripts/polish-probe.mjs's (evidence AC8, AC9, AC13).
import { readFileSync } from 'node:fs';
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
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { BookingChrome } from '@/components/drive-exotiq/BookingChrome';
import { DatesStep } from '@/components/drive-exotiq/flow/DatesStep';
import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { COMMIT_STEP, FLOW_STEPS, stepEyebrow } from '@/components/drive-exotiq/flow/steps';
import * as tokens from '@/components/browse/tokens';
import { createInitialCart } from '@/domain/booking/mockData';
import config from '../../tailwind.config';
import { compileWith, stripComments } from '../design/lib/scan.mjs';
import { NOW_ISO, OPERATOR, VEHICLE, byAttr, elements, fixture, norm, parseHtml, quoteOf, reviewCartOf, textOf } from '../fees/fixtures';
import { renterFiles } from '../restraint/restraintScan';
import {
  CSS, DATES, FLOW, GOLDEN, OVERSCROLL, PROJECT, SF, SHARED, SITEBAR, STEPS, VEP, type Census, baseCensus, captureTokens, census, censusProblems,
  PROTECT_RESTORE, expectedProjectionHash, matchesSelection, cookieMounts, fence, frozenProblems, guardedSelection, lockstepCopy, lockstepProblems, projectionSource, protectLockstepProblems, read, scrollerLiteral, sha,
} from './polishBase';

const noop = () => {};
const loose = (c: unknown) => c as ComponentType<Record<string, unknown>>;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
  vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
  vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('MP-25 surfaces', () => {
  it('the phone scrollers contain their overscroll', async () => {
    const problems: string[] = [];
    const base = baseCensus();
    for (const [label, rel] of [['ScreenShell', SHARED], ['vehicle page', VEP], ['storefront', SF]] as const) {
      const lit = scrollerLiteral(rel);
      const n = lit.split(/[\s`]+/).filter((t) => t === OVERSCROLL).length;
      if (n !== 1) problems.push(`${label}: ${n} ${OVERSCROLL} tokens on its scroller`);
      if (!lit.includes('min-h-0 flex-1 overflow-y-auto')) problems.push(`${label}: the contiguous scroll run is broken`);
      if (/(?:^|\s)[\w-]+:overscroll-/.test(lit)) problems.push(`${label}: a variant-prefixed overscroll token`);
    }
    // The two pages change by exactly that token (the projection removes it and must equal the base).
    for (const rel of [VEP, SF]) if (sha(PROJECT[rel](read(rel))) !== base.projections[rel]) problems.push(`${rel} changed beyond the one token`);
    // Not on the document, the frame or the children wrapper (BookingChrome and the root layout are frozen), not in globals.css.
    if (/overscroll/.test(read(CSS))) problems.push('globals.css sets overscroll');
    const { decls } = await compileWith(config, [OVERSCROLL]);
    if (!decls(OVERSCROLL).includes('overscroll-behavior-y:contain')) problems.push(`${OVERSCROLL} compiles to ${decls(OVERSCROLL).join('; ')}`);
    expect(problems).toEqual([]);
  });

  it('the last step is named Review', () => {
    const problems: string[] = [];
    if (JSON.stringify(FLOW_STEPS) !== JSON.stringify([{ key: 'dates', label: 'Dates' }, { key: 'driver', label: 'Driver' }, { key: 'review', label: 'Review' }])) problems.push(`FLOW_STEPS ${JSON.stringify(FLOW_STEPS)}`);
    if (COMMIT_STEP !== 3) problems.push(`COMMIT_STEP ${COMMIT_STEP}`);
    for (const n of [1, 2, 3]) if (stepEyebrow(n) !== `Step ${n} of 3`) problems.push(`stepEyebrow(${n}) is ${stepEyebrow(n)}`);
    if (sha(PROJECT[STEPS](read(STEPS))) !== baseCensus().projections[STEPS]) problems.push('steps.ts changed beyond the one label');
    const pages: string[] = [];
    for (const n of [1, 2, 3]) {
      const html = renderToStaticMarkup(createElement(loose(BookingChrome), { step: n, closeHref: '/exotiq' }, createElement('p', null, 'x')));
      pages.push(html);
      const nav = byAttr(parseHtml(html), 'data-chrome', 'progress')[0];
      const labels = nav ? elements(nav).filter((e) => e.tag === 'li').map((li) => norm(textOf(li))) : [];
      if (JSON.stringify(labels) !== JSON.stringify(['Dates', 'Driver', 'Review'])) problems.push(`step ${n}: the progress reads ${JSON.stringify(labels)}`);
    }
    const cart = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
    const c = fixture('FX-T1S1P1');
    pages.push(renderToStaticMarkup(createElement(DatesStep, { cart, setCart: noop, next: noop })));
    pages.push(renderToStaticMarkup(createElement(loose(DriverStep), { cart, setCart: noop, next: noop })));
    pages.push(renderToStaticMarkup(createElement(loose(ReviewStep), { cart: reviewCartOf(c), goTo: noop, next: noop, onRequest: noop, quote: quoteOf(c), onProtectionChange: noop })));
    if (pages.some((h) => /Review (?:&amp;|&) Request/.test(h))) problems.push('a rendered step or the progress still says Review & Request');
    for (const rel of renterFiles().filter((r) => /\.tsx?$/.test(r))) if (/\[\s*'Dates',\s*'Driver'/.test(stripComments(read(rel)))) problems.push(`${rel}: a second literal list of step labels`);
    expect(problems).toEqual([]);
  });

  it('MP-25 adds no gold, shadow, box, colour, font or raw hover', () => {
    const problems: string[] = [];
    const base = baseCensus();
    const plants: [string, Census][] = [
      ['a gold utility', { ...base, gold: { ...base.gold, [DATES]: (base.gold[DATES] ?? 0) + 1 }, goldTotal: base.goldTotal + 1 }],
      ['a shadow', { ...base, shadows: [...base.shadows, `${DATES} shadow-lg`].sort() }],
      ['a box', { ...base, boxes: { ...base.boxes, [DATES]: (base.boxes[DATES] ?? 0) + 1 } }],
      ['a tone key', { ...base, toneKeys: [...base.toneKeys, 'frost'].sort() }],
    ];
    for (const [what, planted] of plants) if (!censusProblems(base, planted).length) problems.push(`planted ${what} is not seen`);
    problems.push(...censusProblems(base, census()));
    const rawStyle = (css: string) => /:hover|font-(?:size|family)\s*:|#[0-9a-fA-F]{3,8}\b|rgba?\(|gold/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ''));
    if (!rawStyle('.x:hover { opacity: 1; }')) problems.push('planted: a raw :hover is not seen');
    if (rawStyle(fence(read(CSS)))) problems.push('the polish fence has a :hover, a colour, a font or gold');
    for (const rel of [DATES, SHARED, SITEBAR]) if (/onMouse(?:Enter|Over|Leave)|onPointer(?:Enter|Over|Leave)/.test(stripComments(read(rel)))) problems.push(`${rel}: a script-driven hover`);
    if (!read('tailwind.config.ts').includes('hoverOnlyWhenSupported: true')) problems.push('hoverOnlyWhenSupported is gone');
    expect(problems).toEqual([]);
  });

  it('MP-25 stays off money, consent and frozen files', () => {
    const problems: string[] = [];
    const base = baseCensus();
    if (!frozenProblems(base, (rel) => (rel === FLOW ? `${read(rel)} ` : read(rel))).length) problems.push('planted: an edit to BookingFlow is not seen');
    if (captureTokens(OVERSCROLL).length || !captureTokens('contain-paint lg:will-change-transform').length) problems.push('the capture-token scan is not anchored (locate finding 8)');
    problems.push(...frozenProblems(base, read));
    for (const [key, project] of Object.entries(PROJECT)) if (sha(project(read(projectionSource(key)))) !== expectedProjectionHash(base,key)) problems.push(`${key} changed outside what MP-25 may change`);
    if (!matchesSelection(read(DATES), readFileSync(join(GOLDEN, 'selection-code.base.txt'), 'utf8').trimEnd())) problems.push('the guarded selection code changed');
    if (JSON.stringify(cookieMounts()) !== JSON.stringify(base.mounts)) problems.push(`the cookie mounts changed: ${cookieMounts().join(' | ')}`);
    // The vehicle and storefront scrollers are ancestors of a cookie row: what MP-25 adds there captures nothing.
    for (const rel of [VEP, SF]) {
      const now = scrollerLiteral(rel).split(/[\s`]+/);
      const was = PROJECT[rel](scrollerLiteral(rel)).split(/[\s`]+/);
      const added = now.filter((t) => !was.includes(t));
      if (captureTokens(added.join(' ')).length) problems.push(`${rel}: ${added.join(' ')} would capture the fixed cookie dialog`);
    }
    expect(problems).toEqual([]);
  });

  it('the polish lockstep set is exactly the named amendments', () => {
    const problems: string[] = [];
    const planted = lockstepProblems(lockstepCopy, (rel) => (rel === 'tests/fees/fees.flow.test.ts' ? `${read(rel)}\n// planted` : read(rel)));
    if (!planted.some((p) => p.startsWith('tests/fees/fees.flow.test.ts'))) problems.push('planted: an extra edit in fees.flow.test.ts is not seen');
    problems.push(...lockstepProblems(lockstepCopy, read));
    // Driver errata #3: MP-30's restoration goldens and the restore test's calendar cut, hunk for hunk.
    const recipe = String((tokens as Record<string, unknown>).glassBarClassName ?? '');
    const plantedProtect = protectLockstepProblems((rel) => (rel === PROTECT_RESTORE ? `${read(rel)}\n// planted` : read(rel)), recipe);
    if (!plantedProtect.some((p) => p.startsWith(PROTECT_RESTORE))) problems.push('planted: an extra edit in protect.restore.test.tsx is not seen');
    problems.push(...protectLockstepProblems(read, recipe));
    expect(problems).toEqual([]);
  });
});
