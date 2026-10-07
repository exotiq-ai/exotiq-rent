// MP-25 AC1, AC2, AC3, AC10, AC11, and the polish base recorder: the Dates month grid as a slider.
// Node + react-dom/server + source scans (no DOM library, the house rule since MP-16). The gesture,
// timing, focus and paint halves are scripts/polish-probe.mjs's (evidence AC1, AC2, AC3, AC10, AC11).
//
// Recording (branch base only, before any non-test edit; never overwrites):
//   MP25_RECORD=<base sha> npx vitest run tests/polish/polish.calendar.test.tsx -t "records the polish base"
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
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

import { DatesStep } from '@/components/drive-exotiq/flow/DatesStep';
import { recomputeBookingCart } from '@/components/drive-exotiq/flow/state';
import { createInitialCart } from '@/domain/booking/mockData';
import { NOW_ISO, OPERATOR, VEHICLE } from '../fees/fixtures';
import { literals, prepare } from '../restraint/restraintScan';
import { DATES, GOLDEN, MONTHS, type DaySem, census, copyName, daySemantics, frozenPaths, git, guardedSelection, lockstepPaths, projections, read, sha } from './polishBase';

const noop = () => {};
const cartAt = (month?: string) => {
  const cart = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
  return month ? recomputeBookingCart({ ...cart, dates: { start: `${month}-10`, end: `${month}-13` } }) : cart;
};
const render = (month?: string) => renderToStaticMarkup(createElement(DatesStep, { cart: cartAt(month), setCart: noop, next: noop }));
/** Day semantics for the fixed cart and the seven seeded months, with renter capture on and off. */
function allSemantics(): Record<string, Record<string, DaySem[]>> {
  const out: Record<string, Record<string, DaySem[]>> = {};
  for (const capture of ['on', 'off'] as const) {
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', capture);
    out[`capture-${capture}`] = Object.fromEntries([['fixed', daySemantics(render())], ...MONTHS.map((m) => [m, daySemantics(render(m))])]);
  }
  vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
  return out;
}

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

describe('MP-25 calendar', () => {
  it.skipIf(!process.env.MP25_RECORD)('records the polish base before any source edit (MP25_RECORD=<base sha>, never overwrites)', () => {
    const base = process.env.MP25_RECORD ?? '';
    expect(() => git('merge-base', '--is-ancestor', base, 'HEAD'), 'MP25_RECORD must name the branch base').not.toThrow();
    const changed = [...git('diff', '--name-only', base, 'HEAD').split('\n'), ...git('status', '--porcelain', '--untracked-files=all').split('\n').map((l) => l.slice(3))].filter(Boolean);
    expect(changed.filter((p) => !p.startsWith('tests/polish/')), 'record from the unchanged base').toEqual([]);
    mkdirSync(join(GOLDEN, 'lockstep-base'), { recursive: true });
    const write = (name: string, text: string) => {
      if (!existsSync(join(GOLDEN, name))) writeFileSync(join(GOLDEN, name), text);
    };
    write('calendar-days.base.json', `${JSON.stringify({ cutFrom: base, clock: NOW_ISO, semantics: allSemantics() }, null, 1)}\n`);
    write('selection-code.base.txt', `${guardedSelection(read(DATES))}\n`);
    write('census.base.json', `${JSON.stringify({ cutFrom: base, ...census(), frozen: Object.fromEntries(frozenPaths().map((p) => [p, sha(read(p))])), projections: projections(), datesLiterals: literals(prepare(DATES, read(DATES))) }, null, 1)}\n`);
    for (const rel of lockstepPaths()) write(join('lockstep-base', copyName(rel)), read(rel));
    expect(['calendar-days.base.json', 'selection-code.base.txt', 'census.base.json'].filter((n) => !existsSync(join(GOLDEN, n)))).toEqual([]);
  });
});
