// MP-26 AC4, AC6, AC20: validators for what scripts/fee-matrix.mjs captures in a real browser. The
// hydrated probes (AC4-a11y-probe-390.json, AC6-hierarchy-probe-390.json) must cover all four money
// surfaces: Review & Request and the mock charges come from the mock-mode build (build lane); the
// payment link and the paid receipt come from the live-mode build against the AC11 stub (verify
// lane). The screenshot manifest (AC20-screenshot-matrix.json) must hold every cell of allCells().
// Each validator runs on planted good and bad input in every run; the real files are checked when
// MP26_EVIDENCE_DIR points at the evidence folder.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tone } from '@/components/browse/tokens';
import { allCells, cellName } from '../../scripts/fee-matrix.mjs';

const EVIDENCE = process.env.MP26_EVIDENCE_DIR ?? '';
export const SURFACES = ['review', 'payment', 'paid', 'mock'] as const;
const NAMES: Record<string, string> = { review: 'Review & Request', payment: 'payment link', paid: 'paid receipt', mock: 'mock charges' };
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const GOLD = rgb(tone.gold);
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

type State = { expanded: string | null; regionHidden: boolean | null; regionVisible: boolean; focusOnButton: boolean };
type A11y = { tag: string; role: string | null; type: string | null; name: string; ariaControls: string | null; regionExists: boolean; title: boolean; iconHidden: string | null; box: { width: number; height: number }; initial: State; afterClick: State; afterEnter: State; afterSpace: State; tab: { stops: number; presses: number } };
type Hier = { operator: { text: string | null; weight: number | null; color: string | null }; exotiq: { text: string | null; weight: number | null; color: string | null }; lineLabels: { line: string; weight: number }[]; interGroupGapPx: number };

export function a11yProbeProblems(probe: { surfaces?: Record<string, A11y> }, required: readonly string[] = SURFACES): string[] {
  const p: string[] = [];
  for (const s of required) {
    const e = probe.surfaces?.[s];
    const l = NAMES[s] ?? s;
    if (!e) { p.push(`${l}: not probed${s === 'payment' || s === 'paid' ? ' (needs the AC11 stub, verify lane)' : ''}`); continue; }
    if (e.tag !== 'button' || e.type !== 'button' || e.role !== 'button') p.push(`${l}: the toggle is <${e.tag} type=${e.type} role=${e.role}>`);
    if (e.name !== 'Trip fees') p.push(`${l}: accessible name "${e.name}"`);
    if (!e.ariaControls || !e.regionExists) p.push(`${l}: aria-controls does not point at the region`);
    if (e.title) p.push(`${l}: a title attribute`);
    if (e.iconHidden !== 'true') p.push(`${l}: the icon is not aria-hidden`);
    const steps: [string, State, 'true' | 'false'][] = [['initial', e.initial, 'false'], ['click', e.afterClick, 'true'], ['Enter', e.afterEnter, 'false'], ['Space', e.afterSpace, 'true']];
    for (const [name, st, want] of steps) {
      if (st.expanded !== want) p.push(`${l}: after ${name} aria-expanded ${st.expanded}, expected ${want}`);
      if (st.regionVisible !== (want === 'true')) p.push(`${l}: after ${name} the region is ${st.regionVisible ? 'visible' : 'hidden'}`);
      if (name !== 'initial' && !st.focusOnButton) p.push(`${l}: focus left the button after ${name}`);
    }
    if (e.tab.stops !== 1) p.push(`${l}: reached ${e.tab.stops} time(s) by Tab, expected once`);
    if (e.box.width < 44 || e.box.height < 44) p.push(`${l}: target ${e.box.width}x${e.box.height}, under 44x44`);
  }
  return p;
}

export function hierarchyProbeProblems(probe: { surfaces?: Record<string, Hier> }, required: readonly string[] = SURFACES): string[] {
  const p: string[] = [];
  for (const s of required) {
    const e = probe.surfaces?.[s];
    const l = NAMES[s] ?? s;
    if (!e) { p.push(`${l}: not probed${s === 'payment' || s === 'paid' ? ' (needs the AC11 stub, verify lane)' : ''}`); continue; }
    if (!e.operator.text?.endsWith(' · charged by the operator')) p.push(`${l}: operator header "${e.operator.text}"`);
    if (e.exotiq.text !== 'Drive Exotiq · charged separately — appears as EXOTIQ RENT') p.push(`${l}: Drive Exotiq header "${e.exotiq.text}"`);
    const lineMax = Math.max(0, ...e.lineLabels.map((x) => x.weight));
    for (const [g, h] of [['operator', e.operator], ['Drive Exotiq', e.exotiq]] as const) {
      if ((h.weight ?? 0) < 600) p.push(`${l}: ${g} header weight ${h.weight}`);
      if ((h.weight ?? 0) <= lineMax) p.push(`${l}: ${g} header weight ${h.weight} not above line weight ${lineMax}`);
      if (h.color === GOLD) p.push(`${l}: ${g} header is gold`);
    }
    if (!e.lineLabels.length) p.push(`${l}: no line labels measured`);
    if (e.interGroupGapPx < 16) p.push(`${l}: groups ${e.interGroupGapPx}px apart`);
  }
  return p;
}

type Cell = { state: string; viewport: string; kind: string; fixture?: string; open?: boolean; files: { after: string; before?: string }; bytes: Record<string, number>; sha256: Record<string, string | null>; differs: boolean | null; cards: { after: number | null }; overflow: { after: { innerWidth: number; scrollWidth: number } | null }; hairlinePairs: { after: { gap: number; sameLayer?: boolean }[] | null } };
type Manifest = { cells: Cell[]; axes?: { tax?: { withTax: string[]; taxFree: string[] }; stateFee?: { withStateFee: string[]; noStateFee: string[] }; protect?: { on: string[]; off: string[] }; viewports?: string[]; tripFeesDetail?: { closed: string[]; open: string[] } } };
type Expected = { state: string; viewport: string; kind: string; phases: string[] };

export function matrixProblems(m: Manifest, dir: string | null, cells: Expected[] = allCells() as Expected[]): string[] {
  const p: string[] = [];
  for (const c of cells) {
    const name = cellName(c.state, c.viewport);
    const e = m.cells.find((x) => x.state === c.state && x.viewport === c.viewport);
    if (!e) { p.push(`${name}: not in the manifest`); continue; }
    for (const phase of c.phases as ('after' | 'before')[]) {
      const rel = e.files[phase];
      if (!rel) { p.push(`${name}: no ${phase} file`); continue; }
      if ((e.bytes[phase] ?? 0) === 0) p.push(`${name}: ${phase} PNG empty`);
      if (dir) {
        const file = join(dir, rel);
        if (!existsSync(file) || statSync(file).size === 0) p.push(`${name}: ${phase} PNG missing or empty`);
        else if (sha(file) !== e.sha256[phase]) p.push(`${name}: ${phase} sha256 does not match the manifest`);
      }
    }
    if (c.phases.includes('before') && e.differs !== true) p.push(`${name}: after is identical to before`);
    if (!c.phases.includes('before') && e.files.before) p.push(`${name}: has a before capture (the control did not exist at base)`);
    if (!e.overflow.after) p.push(`${name}: no overflow probe`);
    else if (e.overflow.after.scrollWidth > e.overflow.after.innerWidth) p.push(`${name}: horizontal overflow ${e.overflow.after.scrollWidth} > ${e.overflow.after.innerWidth}`);
    if (!Array.isArray(e.hairlinePairs.after)) p.push(`${name}: no hairline probe`);
    else {
      const doubled = e.hairlinePairs.after.filter((x) => x.sameLayer !== false);
      if (doubled.length) p.push(`${name}: ${doubled.length} doubled hairline(s) in one layer`);
    }
    const money = c.kind === 'fixture' || ['A04', 'A05', 'A06', 'A07'].includes(c.state);
    if (money && e.cards.after !== 1) p.push(`${name}: ${e.cards.after} money cards`);
  }
  const a = m.axes;
  const covered = (label: string, list?: string[]) => { if (!list?.length) p.push(`axis not covered: ${label}`); };
  covered('operator with tax', a?.tax?.withTax);
  covered('tax-free operator', a?.tax?.taxFree);
  covered('state fee', a?.stateFee?.withStateFee);
  covered('no state fee', a?.stateFee?.noStateFee);
  covered('Protect ON', a?.protect?.on);
  covered('Protect OFF', a?.protect?.off);
  covered('Trip-fees detail closed', a?.tripFeesDetail?.closed);
  covered('Trip-fees detail open', a?.tripFeesDetail?.open);
  for (const v of ['320', '390', '1280']) if (!a?.viewports?.includes(v)) p.push(`axis not covered: viewport ${v}`);
  return p;
}

// ---- planted input -------------------------------------------------------------------------------

const okState = (expanded: 'true' | 'false', focus = true): State => ({ expanded, regionHidden: expanded === 'false', regionVisible: expanded === 'true', focusOnButton: focus });
const goodA11y = (): A11y => ({ tag: 'button', role: 'button', type: 'button', name: 'Trip fees', ariaControls: ':r1:trip-fees', regionExists: true, title: false, iconHidden: 'true', box: { width: 86, height: 44 }, initial: okState('false', false), afterClick: okState('true'), afterEnter: okState('false'), afterSpace: okState('true'), tab: { stops: 1, presses: 30 } });
const goodHier = (): Hier => ({ operator: { text: 'Desert Exotic Rentals · charged by the operator', weight: 600, color: 'rgb(240, 242, 245)' }, exotiq: { text: 'Drive Exotiq · charged separately — appears as EXOTIQ RENT', weight: 600, color: 'rgb(240, 242, 245)' }, lineLabels: [{ line: 'rental', weight: 400 }, { line: 'subtotal', weight: 500 }], interGroupGapPx: 33 });
const all = <T,>(f: () => T) => Object.fromEntries(SURFACES.map((s) => [s, f()])) as Record<string, T>;

function goodManifest(): Manifest {
  const cells = (allCells() as Expected[]).map((c): Cell => ({
    state: c.state, viewport: c.viewport, kind: c.kind, files: { after: `a/${c.state}`, ...(c.phases.includes('before') ? { before: `b/${c.state}` } : {}) }, bytes: { after: 10, before: c.phases.includes('before') ? 10 : 0 }, sha256: { after: 'x', before: c.phases.includes('before') ? 'y' : null }, differs: c.phases.includes('before') ? true : null,
    cards: { after: c.kind === 'fixture' || ['A04', 'A05', 'A06', 'A07'].includes(c.state) ? 1 : 0 }, overflow: { after: { innerWidth: 390, scrollWidth: 390 } }, hairlinePairs: { after: [{ gap: 14, sameLayer: false }] },
  }));
  return { cells, axes: { tax: { withTax: ['x'], taxFree: ['y'] }, stateFee: { withStateFee: ['x'], noStateFee: ['y'] }, protect: { on: ['x'], off: ['y'] }, viewports: ['320', '390', '1280'], tripFeesDetail: { closed: ['x'], open: ['y'] } } };
}

describe('MP-26 browser probes and the screenshot matrix (AC4, AC6, AC20)', () => {
  it('disclosure probe shows keyboard toggling and a 44px target', () => {
    expect(a11yProbeProblems({ surfaces: all(goodA11y) })).toEqual([]);
    const bad = (patch: Partial<A11y>) => a11yProbeProblems({ surfaces: { ...all(goodA11y), review: { ...goodA11y(), ...patch } } });
    expect(bad({ afterSpace: okState('false') }).join()).toContain('after Space aria-expanded false');
    expect(bad({ afterEnter: okState('true') }).join()).toContain('after Enter');
    expect(bad({ box: { width: 86, height: 40 } }).join()).toContain('under 44x44');
    expect(bad({ tab: { stops: 2, presses: 30 } }).join()).toContain('2 time(s) by Tab');
    expect(bad({ initial: { ...okState('false'), regionVisible: true } }).join()).toContain('after initial the region is visible');
    expect(bad({ afterClick: okState('true', false) }).join()).toContain('focus left the button');
    expect(bad({ title: true, iconHidden: null }).length).toBe(2);
    expect(a11yProbeProblems({ surfaces: { review: goodA11y(), mock: goodA11y() } })).toEqual(['payment link: not probed (needs the AC11 stub, verify lane)', 'paid receipt: not probed (needs the AC11 stub, verify lane)']);
    if (EVIDENCE) expect(a11yProbeProblems(JSON.parse(readFileSync(join(EVIDENCE, 'AC4-a11y-probe-390.json'), 'utf8')))).toEqual([]);
  });

  it('hierarchy probe shows header weight above line weight and no gold', () => {
    expect(hierarchyProbeProblems({ surfaces: all(goodHier) })).toEqual([]);
    const bad = (patch: Partial<Hier>) => hierarchyProbeProblems({ surfaces: { ...all(goodHier), mock: { ...goodHier(), ...patch } } });
    expect(bad({ operator: { ...goodHier().operator, weight: 500 } }).join()).toContain('header weight 500');
    expect(bad({ exotiq: { ...goodHier().exotiq, color: GOLD } }).join()).toContain('is gold');
    expect(bad({ lineLabels: [{ line: 'rental', weight: 600 }] }).join()).toContain('not above line weight 600');
    expect(bad({ interGroupGapPx: 12 }).join()).toContain('12px apart');
    expect(bad({ exotiq: { ...goodHier().exotiq, text: 'Exotiq Rent' } }).join()).toContain('Drive Exotiq header');
    if (EVIDENCE) expect(hierarchyProbeProblems(JSON.parse(readFileSync(join(EVIDENCE, 'AC6-hierarchy-probe-390.json'), 'utf8')))).toEqual([]);
  });

  it('the screenshot matrix has a clean non-empty cell for every surface, fixture and viewport', () => {
    expect((allCells() as Expected[]).filter((c) => c.kind === 'fixture')).toHaveLength(37);
    expect((allCells() as Expected[]).filter((c) => c.kind === 'app')).toHaveLength(13);
    expect((allCells() as Expected[]).filter((c) => c.phases.includes('before'))).toHaveLength(12);
    expect(matrixProblems(goodManifest(), null)).toEqual([]);
    const planted = (f: (m: Manifest) => void) => { const m = goodManifest(); f(m); return matrixProblems(m, null).join(); };
    expect(planted((m) => { m.cells = m.cells.filter((c) => !(c.state === 'R-FX-T1S1P1' && c.viewport === '320')); })).toContain('R-FX-T1S1P1__320: not in the manifest');
    expect(planted((m) => { m.cells[0].bytes.after = 0; })).toContain('after PNG empty');
    expect(planted((m) => { m.cells.find((c) => c.state === 'A04')!.differs = false; })).toContain('A04__390: after is identical to before');
    expect(planted((m) => { m.cells.find((c) => c.state === 'R-FX-T1S1P1' && c.viewport === '320')!.overflow.after = { innerWidth: 320, scrollWidth: 344 }; })).toContain('horizontal overflow 344 > 320');
    expect(planted((m) => { m.cells.find((c) => c.state === 'A05')!.hairlinePairs.after = [{ gap: 9, sameLayer: true }]; })).toContain('A05__390: 1 doubled hairline(s) in one layer');
    expect(planted((m) => { m.axes!.protect!.off = []; })).toContain('axis not covered: Protect OFF');
    expect(planted((m) => { m.cells.find((c) => c.state === 'A06')!.cards.after = 0; })).toContain('A06__390: 0 money cards');
    if (EVIDENCE) expect(matrixProblems(JSON.parse(readFileSync(join(EVIDENCE, 'AC20-screenshot-matrix.json'), 'utf8')) as Manifest, EVIDENCE)).toEqual([]);
  });
});
