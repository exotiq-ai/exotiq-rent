// MP-16 AC14: the before/after screenshot matrix and the legibility of the demoted text roles.
// The matrix is defined in scripts/restraint-matrix.mjs (imported here with no side effects;
// its capture runs only from the CLI). With RESTRAINT_EVIDENCE_DIR set, the captured manifest
// is checked too: every cell has a non-empty PNG before and after, and they differ.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tone } from '../../components/browse/tokens';
import { EXTRA_STATES, HOVER_STATES, STATES, VIEWPORTS, allCells, cellName } from '../../scripts/restraint-matrix.mjs';
import { contrast } from './restraintScan';

const palette = tone as unknown as Record<string, string>;
const EVIDENCE = process.env.RESTRAINT_EVIDENCE_DIR ?? '';

/** The spec's Screenshot matrix: 14 states at both viewports, 2 desktop-only hover states (MP-26 removed S07, the deleted Pay step). */
const SPEC_STATES = ['S01', 'S02', 'S03', 'S04', 'S05', 'S05b', 'S06', 'S06b', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13'];
const SPEC_HOVER = ['S14', 'S15'];
/** LD8 extras for states mock mode cannot otherwise show (both viewports). */
// X5 (attempt 2, B1): the Dates step with no saved consent, so the cookie row renders nothing.
const EXTRAS = ['X1', 'X2', 'X3', 'X4', 'X5'];

type Cell = { state: string; viewport: string; route: string };
type State = { id: string; route: string; viewports?: string[] };

export function matrixProblems(states: State[], hover: State[], extras: State[], cells: Cell[]): string[] {
  const problems: string[] = [];
  const ids = (list: State[]) => list.map((s) => s.id);
  if (JSON.stringify(ids(states)) !== JSON.stringify(SPEC_STATES)) problems.push(`states ${ids(states).join(',')}`);
  if (JSON.stringify(ids(hover)) !== JSON.stringify(SPEC_HOVER)) problems.push(`hover states ${ids(hover).join(',')}`);
  if (hover.some((s) => JSON.stringify(s.viewports) !== '["desktop"]')) problems.push('a hover state is not desktop-only');
  if (JSON.stringify(ids(extras)) !== JSON.stringify(EXTRAS)) problems.push(`extras ${ids(extras).join(',')}`);
  for (const s of [...states, ...hover, ...extras]) if (!s.route.startsWith('/')) problems.push(`${s.id}: route ${s.route}`);
  const names = cells.map((c) => cellName(c.state, c.viewport));
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) problems.push(`duplicate cells ${dupes.join(',')}`);
  const spec = cells.filter((c) => !EXTRAS.includes(c.state));
  if (spec.length !== 30) problems.push(`${spec.length} spec cells, expected 30 (14 x 2 + 2)`);
  if (cells.length !== 30 + EXTRAS.length * 2) problems.push(`${cells.length} cells, expected ${30 + EXTRAS.length * 2}`);
  return problems;
}

/** Every pairing the demoted roles create, with its floor (AC14 + AC12). */
export const PAIRINGS: [fg: string, bg: string, floor: number][] = [
  ...['ground', 'panel', 'surface'].map((bg): [string, string, number] => ['faint', bg, 4.5]),
  ...['ground', 'panel', 'surface', 'surface2', 'field'].flatMap((bg): [string, string, number][] => [['muted', bg, 4.5], ['ink', bg, 4.5], ['danger', bg, 4.5]]),
  ['goldInk', 'gold', 7.9],
  ['goldInk', 'ink', 16],
];
export const contrastProblems = (pairs: [string, string, number][], colors: Record<string, string>): string[] =>
  pairs.flatMap(([fg, bg, floor]) => {
    if (!colors[fg] || !colors[bg]) return [`${fg} on ${bg}: colour missing from tone`];
    const r = contrast(colors[fg], colors[bg]);
    return r >= floor ? [] : [`${fg} on ${bg}: ${r.toFixed(2)} < ${floor}`];
  });

const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('MP-16 screenshot matrix and legibility (AC14)', () => {
  it('screenshot matrix covers every state and text roles keep contrast', () => {
    expect(VIEWPORTS).toMatchObject({ mobile: { width: 390, height: 844, touch: true }, desktop: { width: 1280, height: 900, touch: false } });
    const cells = allCells() as Cell[];
    expect(matrixProblems(STATES as State[], HOVER_STATES as State[], EXTRA_STATES as State[], cells)).toEqual([]);
    expect(contrastProblems(PAIRINGS, palette)).toEqual([]);

    // Planted: a missing state, a duplicate cell and an unreadable pairing are each caught.
    const short = (STATES as State[]).filter((s) => s.id !== 'S05b');
    expect(matrixProblems(short, HOVER_STATES as State[], EXTRA_STATES as State[], cells).length).toBeGreaterThan(0);
    expect(matrixProblems(STATES as State[], HOVER_STATES as State[], EXTRA_STATES as State[], [...cells, cells[0]]).join()).toContain('duplicate cells');
    expect(contrastProblems([['dim', 'ground', 4.5]], palette)).toHaveLength(1);
  });

  it.skipIf(!EVIDENCE)('the captured matrix has a non-empty, different PNG before and after for every cell (RESTRAINT_EVIDENCE_DIR)', () => {
    type Pair = { gap: number; sameLayer?: boolean };
    const manifest = JSON.parse(readFileSync(join(EVIDENCE, 'AC14-screenshot-matrix.json'), 'utf8')) as { cells: { state: string; viewport: string; before: string; after: string; sha256: { before: string; after: string }; hairlinePairs?: { before?: Pair[]; after?: Pair[] } }[] };
    const problems: string[] = [];
    for (const c of allCells() as Cell[]) {
      const entry = manifest.cells.find((m) => m.state === c.state && m.viewport === c.viewport);
      const name = cellName(c.state, c.viewport);
      if (!entry) { problems.push(`${name}: not in the manifest`); continue; }
      for (const phase of ['before', 'after'] as const) {
        const file = join(EVIDENCE, entry[phase]);
        if (!existsSync(file) || statSync(file).size === 0) problems.push(`${name}: ${phase} PNG missing or empty`);
        else if (sha(file) !== entry.sha256[phase]) problems.push(`${name}: ${phase} sha256 does not match the manifest`);
      }
      if (entry.sha256.before === entry.sha256.after) problems.push(`${name}: after is identical to before`);
      // B1: a browser probe of two horizontal hairlines within 20px. Every after cell is measured; none may
      // double inside one layer (a fixed bar, or the page flow). Pairs across layers are scrolling content
      // passing a fixed bar's edge at the captured scroll offset: recorded in the manifest, not a defect.
      const pairs = entry.hairlinePairs?.after;
      const doubled = Array.isArray(pairs) ? pairs.filter((p) => p.sameLayer !== false) : [];
      if (!Array.isArray(pairs)) problems.push(`${name}: no hairline probe in the manifest`);
      else if (doubled.length) problems.push(`${name}: ${doubled.length} doubled hairline(s) ${JSON.stringify(doubled)}`);
    }
    expect(problems).toEqual([]);
  });
});
