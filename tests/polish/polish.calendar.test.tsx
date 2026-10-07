// MP-25 AC1, AC2, AC3, AC10, AC11, and the polish base recorder: the Dates month grid as a slider.
// Node + react-dom/server + source scans (no DOM library, the house rule since MP-16). The gesture,
// timing, focus and paint halves are scripts/polish-probe.mjs's (evidence AC1, AC2, AC3, AC10, AC11).
//
// Recording (branch base only, before any non-test edit; never overwrites):
//   MP25_RECORD=<base sha> npx vitest run tests/polish/polish.calendar.test.tsx -t "records the polish base"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import { stripComments } from '../design/lib/scan.mjs';
import { NOW_ISO, OPERATOR, VEHICLE, type El, byAttr, classes, elements, parseHtml } from '../fees/fixtures';
import { goldCount, literals, prepare, renterFiles } from '../restraint/restraintScan';
import {
  CSS, DATES, GOLDEN, MONTHS, PAGER, type DaySem, activeByFile, animations, baseCensus, census, copyName, daySemantics, fence,
  frozenPaths, git, guardedSelection, keyframes, loadPager, lockstepPaths, ms, projections, read, readGolden, sha,
} from './polishBase';

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
const fnBody = (src: string, name: string): string => new RegExp(`const ${name} = [\\s\\S]*?\\n {2}};`).exec(src)?.[0] ?? '';

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

  it('the month grid takes horizontal swipes and leaves vertical panning to the page', async () => {
    const problems: string[] = [];
    const touchNone = (src: string) => /(^|[\s'"`:])touch-none(?![\w-])|touchAction:\s*'none'/.test(src);
    if (!touchNone('<div className="touch-none" />')) problems.push('planted: a touch-none grid is not seen');
    const pager = await loadPager();
    if (!pager) problems.push(`${PAGER} does not exist`);
    else {
      for (const W of [358, 288]) {
        // The grid's width at 390 and at 320 (the frame minus ScreenShell's px-4).
        const swipe = (ratio: number, ms: number, dir: 1 | -1 = 1) => {
          const dx = -dir * ratio * W;
          const samples = Array.from({ length: 11 }, (_, k) => ({ x: 200 + (dx * k) / 10, y: 300, t: (ms * k) / 10 }));
          return pager.pageDecision({ dx, width: W, velocity: pager.releaseVelocity(samples), canPrev: true, canNext: true });
        };
        if (swipe(0.6, 250) !== 1) problems.push(`W=${W}: a 60% swipe in 250ms does not page forward`);
        if (swipe(0.6, 250, -1) !== -1) problems.push(`W=${W}: a 60% swipe left to right does not page back`);
        if (swipe(0.12, 600) !== 0) problems.push(`W=${W}: a 12% drag in 600ms pages`);
        if (swipe(0.25, 100) !== 1) problems.push(`W=${W}: a 25% flick in 100ms does not page`);
        if (swipe(0.9, 300) !== 1) problems.push(`W=${W}: a 90% swipe is not exactly one page`);
        if (pager.pageDecision({ dx: 0.6 * W, width: W, velocity: 2, canPrev: false, canNext: true }) !== 0) problems.push(`W=${W}: left to right on the first month pages`);
        if (pager.pageDecision({ dx: -0.6 * W, width: W, velocity: -2, canPrev: true, canNext: false }) !== 0) problems.push(`W=${W}: right to left on the last month pages`);
        for (const dx of [-0.3 * W, 0.3 * W]) if (Math.abs(pager.dragOffset(dx, true, true, W)) < Math.abs(dx) / 2) problems.push(`W=${W}: the grid follows ${dx}px by less than half`);
        if (Math.abs(pager.dragOffset(0.3 * W, false, true, W)) < (0.3 * W) / 2) problems.push(`W=${W}: the first-month resistance follows by less than half`);
      }
      if (pager.lockAxis(10, 30) !== 'y' || pager.lockAxis(20, 40) !== 'y') problems.push('a mostly vertical gesture (dy at least 2dx) is not left to the page');
      if (pager.lockAxis(30, 10) !== 'x') problems.push('a horizontal gesture is not taken');
      if (pager.lockAxis(3, 4) !== null) problems.push('the axis locks inside the slop');
    }
    const src = stripComments(read(DATES));
    const vp = byAttr(parseHtml(render()), 'data-calendar', 'viewport');
    if (vp.length !== 1) problems.push(`${vp.length} [data-calendar="viewport"] elements`);
    else for (const t of ['touch-pan-y', 'overflow-hidden']) if (!classes(vp[0]).includes(t)) problems.push(`the viewport lacks ${t}`);
    if (touchNone(src)) problems.push('DatesStep claims touch-action none');
    for (const h of ['onPointerDown={onPointerDown}', 'onPointerMove={onPointerMove}', 'onPointerUp={onPointerEnd}', 'onPointerCancel={onPointerEnd}', 'onClickCapture={onClickCapture}']) if (!src.includes(h)) problems.push(`the viewport lacks ${h}`);
    if (!/swallowClick\.current[\s\S]*?stopPropagation\(\)/.test(fnBody(src, 'onClickCapture'))) problems.push('a swipe that starts on a day can still select it (no click swallow)');
    expect(problems).toEqual([]);
  });

  it('six rows are reserved and one month is reachable at a time', async () => {
    const problems: string[] = [];
    for (const m of MONTHS) {
      const root = parseHtml(render(m));
      const vps = byAttr(root, 'data-calendar', 'viewport');
      const panes = byAttr(root, 'data-calendar', 'month');
      if (vps.length !== 1 || panes.length !== 1) {
        problems.push(`${m}: ${vps.length} viewport(s) and ${panes.length} rendered month(s) at rest`);
        continue;
      }
      const cells = panes[0].children.filter((c): c is El => typeof c !== 'string');
      const round = cells.filter((c) => classes(c).includes('aspect-square')).length;
      if (cells.length !== 42 || round !== 42) problems.push(`${m}: ${cells.length} cells, ${round} square (six week rows need 42)`);
      if (!classes(panes[0]).includes('grid-cols-7')) problems.push(`${m}: the month is not a seven-column grid`);
      const [y, mo] = m.split('-').map(Number);
      const days = elements(panes[0]).filter((e) => e.tag === 'button').length;
      if (days !== new Date(y, mo, 0).getDate()) problems.push(`${m}: ${days} day buttons`);
      if (elements(root).some((e) => 'inert' in e.attrs || (e.attrs['aria-hidden'] === 'true' && elements(e).some((d) => d.tag === 'button')))) problems.push(`${m}: the visible month is inert or hidden`);
      const chevron = (label: string) => elements(root).find((e) => e.attrs['aria-label'] === label);
      const prev = chevron('Previous month');
      const next = chevron('Next month');
      if (!prev || !next) problems.push(`${m}: a chevron is missing`);
      else {
        if ('disabled' in prev.attrs !== (m === MONTHS[0])) problems.push(`${m}: Previous disabled=${'disabled' in prev.attrs}`);
        if ('disabled' in next.attrs !== (m === MONTHS[MONTHS.length - 1])) problems.push(`${m}: Next disabled=${'disabled' in next.attrs}`);
      }
    }
    const src = stripComments(read(DATES));
    if (!/ref=\{markInert\} aria-hidden="true"/.test(src)) problems.push('the month sliding in is not inert and hidden from assistive tech');
    if (!fnBody(src, 'page').includes('settle(') || !fnBody(src, 'onPointerEnd').includes('settle(')) problems.push('the chevrons and the swipe do not settle with one slide');
    const pager = await loadPager();
    if (!pager) problems.push(`${PAGER} does not exist`);
    else {
      if (!(pager.SETTLE_MS >= 150 && pager.SETTLE_MS <= 380)) problems.push(`SETTLE_MS ${pager.SETTLE_MS} (a chevron page must finish within 400ms)`);
      if (pager.settleTransition(true) !== 'none' || !pager.settleTransition(false).startsWith(`transform ${pager.SETTLE_MS}ms`)) problems.push(`settleTransition: ${pager.settleTransition(false)} / ${pager.settleTransition(true)}`);
    }
    expect(problems).toEqual([]);
  });

  it('selection is byte-identical to the base and only the tapped disc springs', () => {
    const problems: string[] = [];
    const now = read(DATES);
    const want = readFileSync(join(GOLDEN, 'selection-code.base.txt'), 'utf8').trimEnd();
    if (guardedSelection(now.replace('iso <= startIso) {', 'iso < startIso) {')) === want) problems.push('planted: an edit to selectDay is not seen');
    if (guardedSelection(now) !== want) problems.push('the guarded selection code differs from the base');
    const recorded = readGolden<{ semantics: Record<string, Record<string, DaySem[]>> }>('calendar-days.base.json').semantics;
    const got = allSemantics();
    for (const variant of Object.keys(recorded)) {
      for (const key of Object.keys(recorded[variant])) if (JSON.stringify(got[variant]?.[key]) !== JSON.stringify(recorded[variant][key])) problems.push(`${variant} ${key}: day names or states differ from the base`);
    }
    const f = fence(read(CSS));
    const spring = keyframes(f, 'daySpring');
    if (!spring) problems.push('no @keyframes daySpring in the polish fence');
    else {
      if (spring.props.some((p) => p !== 'transform')) problems.push(`daySpring animates ${spring.props.join(', ')}`);
      const scales = spring.frames.map((fr) => Number(/scale\(([\d.]+)\)/.exec(fr)?.[1] ?? NaN));
      const peak = Math.max(...scales);
      if (!(scales[0] >= 0.8 && scales[0] <= 0.9) || !(peak >= 1.03 && peak <= 1.06) || scales[scales.length - 1] !== 1) problems.push(`daySpring scales ${scales.join(' -> ')}`);
      if (spring.frames.some((fr) => !fr.includes('translate(-50%, -50%)'))) problems.push('daySpring drops the disc centring');
    }
    const a = animations(f).find((x) => x.selector === '.animate-day-spring');
    const d = ms(a?.times[0]);
    if (!a || !(d >= 240 && d <= 420)) problems.push(`.animate-day-spring: ${a?.value ?? 'missing'}`);
    const src = stripComments(now);
    if (!/rounded-full bg-gold\$\{iso === springIso \? ' animate-day-spring' : ''\}/.test(src)) problems.push('the spring class is not keyed to the tapped day');
    const setters = Array.from(src.matchAll(/setSpringIso\(([^)]*)\)/g), (m) => m[1]);
    if (setters.filter((x) => x === 'iso').length !== 1 || setters.some((x) => x !== 'iso' && x !== 'null')) problems.push(`setSpringIso is called with: ${setters.join(', ')}`);
    for (const m of [undefined, ...MONTHS]) if (render(m).includes('animate-day-spring')) problems.push(`the spring plays on first render (${m ?? 'fixed cart'})`);
    if (goldCount(prepare(DATES, now)) !== baseCensus().gold[DATES]) problems.push(`DatesStep gold ${goldCount(prepare(DATES, now))}, base ${baseCensus().gold[DATES]}`);
    const holders = renterFiles().filter((r) => read(r).includes('data-calendar'));
    if (JSON.stringify(holders) !== JSON.stringify([DATES])) problems.push(`the month grid lives in ${holders.join(', ') || 'no file'}`);
    if (/gold/i.test(f.replace(/\/\*[\s\S]*?\*\//g, ''))) problems.push('a polish class or keyframe name says gold');
    expect(problems).toEqual([]);
  });

  it('the range wash either fades in on the closing tap or is unchanged', () => {
    const problems: string[] = [];
    const src = stripComments(read(DATES));
    const washes = (lits: string[]) => lits.filter((s) => /\bbg-gold\/10\b/.test(s));
    if (src.includes('animate-wash-in')) {
      const f = fence(read(CSS));
      const k = keyframes(f, 'washIn');
      if (!k || k.props.some((p) => p !== 'opacity')) problems.push(`washIn animates ${k?.props.join(', ') ?? 'nothing'} (opacity only)`);
      const d = ms(animations(f).find((x) => x.selector === '.animate-wash-in')?.times[0]);
      if (!(d >= 120 && d <= 200)) problems.push(`.animate-wash-in ${d}ms`);
      if (!/const washIn = springIso !== null && springIso === endIso && !awaitingEnd;/.test(src)) problems.push('the wash fade is not keyed to the closing tap');
      if (washes(literals(src)).length !== 3) problems.push('the three wash layers changed count');
    } else if (JSON.stringify(washes(literals(prepare(DATES, read(DATES))))) !== JSON.stringify(washes(baseCensus().datesLiterals))) problems.push('the wash differs from the base without the fade');
    for (const m of [undefined, ...MONTHS]) if (render(m).includes('animate-wash-in')) problems.push(`the wash fades on first render (${m ?? 'fixed cart'})`);
    expect(problems).toEqual([]);
  });

  it('calendar press feedback is either scoped and motion-safe or absent', () => {
    const problems: string[] = [];
    const base = baseCensus();
    const now = literals(prepare(DATES, read(DATES)));
    const day = (lits: string[]) => lits.find((s) => s.includes('relative aspect-square text-muted outline-none')) ?? '';
    const chevrons = (lits: string[]) => lits.filter((s) => s.includes('grid h-8 w-8 place-items-center rounded-lg'));
    const toks = (s: string) => s.split(/\s+/);
    if (/active:/.test(day(now)) || chevrons(now).some((s) => /active:/.test(s))) {
      const scale = /(?:^|\s)active:before:scale-\[(0\.9\d)\]/.exec(day(now))?.[1];
      if (!scale || Number(scale) < 0.94 || Number(scale) > 0.98) problems.push(`day press scale ${scale ?? 'missing'}`);
      for (const t of ['motion-reduce:active:before:scale-100', 'before:transition-transform']) if (!toks(day(now)).includes(t)) problems.push(`the day button lacks ${t}`);
      if (!toks(day(now)).some((t) => /^before:duration-(75|100)$/.test(t))) problems.push('the day press is slower than 120ms');
      for (const c of chevrons(now)) {
        const s = /(?:^|\s)active:scale-\[(0\.9\d)\]/.exec(c)?.[1];
        if (!s || Number(s) < 0.94 || Number(s) > 0.98) problems.push(`chevron press scale ${s ?? 'missing'}`);
        if (!toks(c).includes('motion-reduce:active:scale-100') || !toks(c).some((t) => /^duration-(75|100)$/.test(t))) problems.push('a chevron press is not motion-safe or is slower than 120ms');
      }
      if (/hover:[^\s]*scale/.test(day(now))) problems.push('the press depends on hover');
    } else {
      if (day(now) !== day(base.datesLiterals)) problems.push('the day button differs from the base without press feedback');
      if (JSON.stringify(chevrons(now)) !== JSON.stringify(chevrons(base.datesLiterals))) problems.push('the chevrons differ from the base without press feedback');
    }
    const active = activeByFile();
    for (const file of Array.from(new Set([...Object.keys(active), ...Object.keys(base.active)]))) if (file !== DATES && (active[file] ?? 0) !== (base.active[file] ?? 0)) problems.push(`${file}: ${active[file] ?? 0} active: tokens, base ${base.active[file] ?? 0} (press feedback outside the calendar)`);
    expect(problems).toEqual([]);
  });
});
