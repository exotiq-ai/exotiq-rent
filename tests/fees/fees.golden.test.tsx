// MP-26 AC19 (and the base goldens AC5 and AC8 compare against). What this ticket does not
// change is byte-identical to the base: DatesStep and DriverStep (fixed clock, fixed cart, mock
// mode), the Sticky footer and the panel frame's header row, rendered with react-dom/server, equal
// goldens recorded from the base commit BEFORE the first source edit, after cutting only the
// places this ticket changes (the two eyebrows, the one DriverStep sentence, the step strip).
//
// Recording (base only): MP26_RECORD=1 npx vitest run tests/fees/fees.golden.test.tsx
// The recorder never overwrites a golden and refuses to run once any non-test file has changed.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentType } from 'react';
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

import { PhoneViewport, PrimaryButton } from '@/components/drive-exotiq/BookingChrome';
import { DatesStep } from '@/components/drive-exotiq/flow/DatesStep';
import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { Sticky } from '@/components/drive-exotiq/flow/shared';
import { createInitialCart } from '@/domain/booking/mockData';
import { NOW_ISO, OPERATOR, VEHICLE, fixture, quoteOf, reviewCartOf } from './fixtures';
import {
  BASE_JSON,
  GOLDEN_DIR,
  GOLDEN_FILES,
  type GoldenFile,
  barsStrip,
  cutDates,
  cutDriver,
  git,
  numberedStrip,
  panelHeaderRow,
  readGolden,
  sha256,
  switchBlock,
} from './goldens';

const noop = () => {};
const EVIDENCE = process.env.MP26_EVIDENCE_DIR ?? '';

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

/** The four AC19 renders, cut. The cart is the mock cart under the fixed clock. */
function ac19Renders(): Record<'dates-step.html' | 'driver-step.html' | 'sticky-footer.html' | 'panel-header-row.html', string> {
  const cart = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
  return {
    'dates-step.html': cutDates(renderToStaticMarkup(<DatesStep cart={cart} setCart={noop} next={noop} />)),
    'driver-step.html': cutDriver(renderToStaticMarkup(<DriverStep cart={cart} setCart={noop} next={noop} />)),
    'sticky-footer.html': renderToStaticMarkup(<Sticky><PrimaryButton onClick={noop}>Continue</PrimaryButton></Sticky>),
    'panel-header-row.html': panelHeaderRow(renderToStaticMarkup(<PhoneViewport step={2} layout="panel"><p>x</p></PhoneViewport>)),
  };
}

/** Base-only renders for AC5 (the Protect switch block) and AC8 (the other callers' step strips). */
function baseOnlyRenders(): Record<'protect-switch-on.html' | 'protect-switch-off.html' | 'stepbar-default-6.html' | 'stepbar-numbered.html', string> {
  // Props go through a loose spread: the base ReviewStep takes `next`, the merged one does not.
  const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;
  const review = (id: 'FX-T1S1P1' | 'FX-T1S1P0') => {
    const c = fixture(id);
    return renderToStaticMarkup(<Review cart={reviewCartOf(c)} goTo={noop} next={noop} onRequest={noop} quote={quoteOf(c)} onProtectionChange={noop} />);
  };
  return {
    'protect-switch-on.html': switchBlock(review('FX-T1S1P1')),
    'protect-switch-off.html': switchBlock(review('FX-T1S1P0')),
    'stepbar-default-6.html': barsStrip(renderToStaticMarkup(<PhoneViewport step={6} layout="panel"><p>x</p></PhoneViewport>)),
    'stepbar-numbered.html': numberedStrip(renderToStaticMarkup(<PhoneViewport step={1} stepStyle="numbered" layout="page"><p>x</p></PhoneViewport>)),
  };
}

type Base = { cutFrom: string; recordedAt: string; recordedOn: string; files: Record<GoldenFile, string> };
const readBase = (): Base => JSON.parse(readFileSync(BASE_JSON, 'utf8')) as Base;

/** Paths outside tests/ and vitest.config.mts: what "a source edit" means for the recording rule. */
const isSource = (p: string) => !p.startsWith('tests/') && p !== 'vitest.config.mts';

describe('MP-26 base goldens (AC19)', () => {
  it.skipIf(!process.env.MP26_RECORD)('records the base goldens before any source edit (MP26_RECORD, never overwrites)', () => {
    const cutFrom = git('merge-base', 'HEAD', 'main');
    const committed = git('diff', '--name-only', cutFrom, 'HEAD').split('\n').filter(Boolean).filter(isSource);
    const dirty = git('status', '--porcelain').split('\n').filter(Boolean).map((l) => l.slice(3)).filter(isSource);
    expect([...committed, ...dirty], 'goldens must be recorded from the unchanged base').toEqual([]);
    mkdirSync(GOLDEN_DIR, { recursive: true });
    const all = { ...ac19Renders(), ...baseOnlyRenders() };
    const written: string[] = [];
    for (const name of GOLDEN_FILES) {
      const file = join(GOLDEN_DIR, name);
      if (existsSync(file)) continue;
      writeFileSync(file, all[name]);
      written.push(name);
    }
    if (!existsSync(BASE_JSON)) {
      const files = Object.fromEntries(GOLDEN_FILES.map((n) => [n, sha256(readGolden(n))])) as Record<GoldenFile, string>;
      const base: Base = { cutFrom, recordedAt: git('rev-parse', 'HEAD'), recordedOn: new Date(vi.getRealSystemTime()).toISOString(), files };
      writeFileSync(BASE_JSON, `${JSON.stringify(base, null, 1)}\n`);
    }
    expect(GOLDEN_FILES.filter((n) => !existsSync(join(GOLDEN_DIR, n)))).toEqual([]);
  });

  it('unchanged steps and chrome match the base goldens', () => {
    const problems: string[] = [];
    const base = readBase();

    // The recorded hashes are the files' hashes (nobody edited a golden after recording).
    for (const name of GOLDEN_FILES) if (sha256(readGolden(name)) !== base.files[name]) problems.push(`${name}: sha256 differs from base.json`);

    // The goldens were committed before the first source edit: the commit that added base.json
    // is an ancestor of every commit since the cut that touches a non-test path.
    const goldenCommit = git('log', '--diff-filter=A', '--format=%H', '--', 'tests/fees/golden/base.json').split('\n').filter(Boolean).pop() ?? '';
    if (!goldenCommit) problems.push('base.json is not committed');
    const firstSource = git('rev-list', '--reverse', `${base.cutFrom}..HEAD`).split('\n').filter(Boolean).find((sha) => git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean).some(isSource));
    if (goldenCommit && firstSource) {
      try { git('merge-base', '--is-ancestor', goldenCommit, firstSource); } catch { problems.push(`golden commit ${goldenCommit.slice(0, 7)} is not an ancestor of the first source commit ${firstSource.slice(0, 7)}`); }
      if (goldenCommit === firstSource) problems.push('the goldens landed in the same commit as a source edit');
    }
    try { git('merge-base', '--is-ancestor', base.cutFrom, 'HEAD'); } catch { problems.push(`cut-from ${base.cutFrom.slice(0, 7)} is not an ancestor of HEAD`); }

    // Re-render now and compare, naming the element that moved.
    const now = ac19Renders();
    for (const [name, html] of Object.entries(now) as [GoldenFile, string][]) {
      const want = readGolden(name);
      if (html !== want) {
        let i = 0;
        while (i < html.length && html[i] === want[i]) i++;
        problems.push(`${name}: differs at ${i}: base "…${want.slice(Math.max(0, i - 60), i + 60)}…" now "…${html.slice(Math.max(0, i - 60), i + 60)}…"`);
      }
    }

    // Planted: one changed class in DatesStep is caught by the same comparison.
    const planted = now['dates-step.html'].replace('grid grid-cols-7', 'grid grid-cols-6');
    expect(planted).not.toBe(readGolden('dates-step.html'));

    if (EVIDENCE) {
      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, 'AC19-golden-base.txt'), [
        `MP-26 AC19 base goldens`,
        `cut from (base sha): ${base.cutFrom}`,
        `recorded at commit:  ${base.recordedAt} (${base.recordedOn})`,
        `goldens committed in: ${goldenCommit}`,
        `first source commit:  ${firstSource ?? '(none yet)'}`,
        `ancestor check:       ${problems.some((p) => p.includes('ancestor') || p.includes('same commit')) ? 'FAIL' : 'pass'}`,
        '',
        'sha256 of every golden file:',
        ...GOLDEN_FILES.map((n) => `${sha256(readGolden(n))}  tests/fees/golden/${n}`),
        '',
      ].join('\n'));
    }
    expect(problems).toEqual([]);
  });
});
