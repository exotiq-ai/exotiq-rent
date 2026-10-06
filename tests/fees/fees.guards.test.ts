// MP-26 AC17 and AC18: display only, mechanically, and the MP-15/16 suites change only by the five
// lockstep amendments. The diff proofs run with MP26_BASE_REF set to the recorded base commit; the
// matchers they rely on are unit-checked on synthetic input in every run, so a gated test can never
// pass by checking nothing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.MP26_BASE_REF ?? '';
const EVIDENCE = process.env.MP26_EVIDENCE_DIR ?? '';
const git = (...args: string[]) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
/** Paths changed between the base and the working tree (committed and uncommitted), plus untracked files. */
const changedSince = (base: string) => Array.from(new Set([...lines(git('diff', '--name-only', base)), ...lines(git('ls-files', '--others', '--exclude-standard'))])).sort();

// ---- AC17 ---------------------------------------------------------------------------------------

export const PROTECTED_PREFIXES = ['domain/', 'supabase/', 'netlify/', 'scripts/canary/', 'components/analytics/', 'docs/analytics/', 'components/renters/', 'app/api/', 'app/privacy/'];
export const PROTECTED_FILES = ['app/layout.tsx', 'package.json', 'package-lock.json', 'tailwind.config.ts', 'components/browse/tokens.ts', 'app/globals.css', 'next.config.js', 'tsconfig.json'];
export const protectedHits = (paths: string[]): string[] => paths.filter((p) => PROTECTED_PREFIXES.some((x) => p.startsWith(x)) || PROTECTED_FILES.includes(p));

// ---- AC18 ---------------------------------------------------------------------------------------

export const LOCKSTEP = [
  'scripts/restraint-matrix.mjs',
  'tests/restraint/restraint.danger.test.ts',
  'tests/restraint/restraint.gold.test.ts',
  'tests/restraint/restraint.layout.test.ts',
  'tests/restraint/restraint.matrix.test.ts',
];
const inSuites = (p: string) => p.startsWith('tests/restraint/') || p.startsWith('tests/design/') || p === 'scripts/restraint-matrix.mjs';
/** `it(` and `it.skipIf(…)(` calls. */
export const itCount = (text: string) => (text.match(/\bit(?:\.\w+\([^)]*\))?\(/g) ?? []).length;
/** Every `*_CEILING = n` constant and every `[KEY]: n` row of a *_BUDGET map. */
export function ceilings(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Array.from(text.matchAll(/\b([A-Z][A-Z_]*CEILING)\s*=\s*(\d+)/g))) out[m[1]] = Number(m[2]);
  for (const m of Array.from(text.matchAll(/\b([A-Z][A-Z_]*BUDGET)\b[^=]*=\s*\{([\s\S]*?)\n\};/g))) {
    for (const row of Array.from(m[2].matchAll(/\[([A-Z_]+)\]:\s*(\d+)/g))) out[`${m[1]}.${row[1]}`] = Number(row[2]);
  }
  return out;
}
/** Findings for one file's before/after text: a dropped it(, a raised ceiling or budget row. */
export function amendmentProblems(file: string, before: string, after: string): string[] {
  const problems: string[] = [];
  if (itCount(after) !== itCount(before)) problems.push(`${file}: it( count ${itCount(before)} -> ${itCount(after)}`);
  const [b, a] = [ceilings(before), ceilings(after)];
  for (const [k, v] of Object.entries(a)) if (k in b && v > b[k]) problems.push(`${file}: ${k} rose ${b[k]} -> ${v}`);
  for (const k of Object.keys(a)) if (!(k in b)) problems.push(`${file}: new ceiling ${k}`);
  return problems;
}
/** The changed suite files must be exactly the five, none under tests/design/. */
export function suiteSetProblems(changed: string[]): string[] {
  const suites = changed.filter(inSuites).sort();
  const problems: string[] = [];
  for (const p of suites) if (!LOCKSTEP.includes(p)) problems.push(`${p}: changed, not a lockstep file`);
  for (const p of LOCKSTEP) if (!suites.includes(p)) problems.push(`${p}: lockstep file unchanged`);
  for (const p of suites) if (p.startsWith('tests/design/')) problems.push(`${p}: tests/design/ must not change`);
  return problems;
}

describe('MP-26 guards (AC17, AC18)', () => {
  it('no pricing, analytics, consent, canary or dependency path changes', () => {
    // The matcher, on a synthetic list (always on).
    const planted = ['domain/booking/totals.ts', 'scripts/canary/renter-canary.ts', 'components/analytics/policy.ts', 'package.json', 'package-lock.json', 'app/privacy/page.tsx', 'app/api/renters/route.ts', 'components/renters/bookingCapture.ts', 'docs/analytics/runbook.md', 'app/layout.tsx', 'tailwind.config.ts', 'components/browse/tokens.ts', 'app/globals.css', 'next.config.js', 'tsconfig.json', 'supabase/functions/x.ts', 'netlify/edge.ts'];
    expect(protectedHits(planted)).toEqual(planted);
    const allowed = ['components/drive-exotiq/feeGroups.ts', 'components/drive-exotiq/FeeCard.tsx', 'tests/fees/fixtures.ts', 'scripts/fee-matrix.mjs', 'vitest.config.mts', 'tests/restraint/restraint.gold.test.ts', 'app/[operatorSlug]/page.tsx'];
    expect(protectedHits(allowed)).toEqual([]);

    if (!BASE) return;
    const changed = changedSince(BASE);
    const hits = protectedHits(changed);
    if (EVIDENCE) {
      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, 'AC17-protected-paths.txt'), [
        'MP-26 AC17: protected paths untouched',
        `base: ${git('rev-parse', BASE).trim()} (MP26_BASE_REF=${BASE})`,
        `head: ${git('rev-parse', 'HEAD').trim()}`,
        `changed paths (${changed.length}):`,
        ...changed.map((p) => `  ${p}`),
        '',
        'verdict per protected prefix / file:',
        ...[...PROTECTED_PREFIXES, ...PROTECTED_FILES].map((x) => {
          const n = changed.filter((p) => (x.endsWith('/') ? p.startsWith(x) : p === x)).length;
          return `  ${n === 0 ? 'UNTOUCHED' : 'TOUCHED  '} ${x}${n ? ` (${n})` : ''}`;
        }),
        '',
        `protected hits: ${hits.length}`,
        '',
      ].join('\n'));
    }
    expect(hits).toEqual([]);
  });

  it('lockstep amendments are exactly the five listed files', () => {
    // The checkers, on planted input (always on).
    expect(itCount("it('a', () => {}); it.skipIf(!X)('b', () => {}); edit(1); split(2)")).toBe(2);
    expect(ceilings('export const GOLD_TOTAL_CEILING = 44;\nexport const GOLD_BUDGET: Record<string, number> = {\n  [TOKENS]: 9,\n  [PAY]: 1,\n};')).toEqual({ GOLD_TOTAL_CEILING: 44, 'GOLD_BUDGET.TOKENS': 9, 'GOLD_BUDGET.PAY': 1 });
    const before = "export const GOLD_TOTAL_CEILING = 44;\nconst GOLD_BUDGET = {\n  [TOKENS]: 9,\n};\nit('x', f); it('y', f);";
    expect(amendmentProblems('f.ts', before, before.replace('44', '43'))).toEqual([]);
    expect(amendmentProblems('f.ts', before, before.replace('44', '45'))).toEqual(['f.ts: GOLD_TOTAL_CEILING rose 44 -> 45']);
    expect(amendmentProblems('f.ts', before, before.replace('[TOKENS]: 9', '[TOKENS]: 10'))).toEqual(['f.ts: GOLD_BUDGET.TOKENS rose 9 -> 10']);
    expect(amendmentProblems('f.ts', before, before.replace("it('y', f);", ''))).toEqual(['f.ts: it( count 2 -> 1']);
    expect(suiteSetProblems([...LOCKSTEP, 'components/x.tsx'])).toEqual([]);
    expect(suiteSetProblems([...LOCKSTEP, 'tests/restraint/restraint.cta.test.ts'])).toEqual(['tests/restraint/restraint.cta.test.ts: changed, not a lockstep file']);
    expect(suiteSetProblems([...LOCKSTEP, 'tests/design/tokens.test.ts'])).toHaveLength(2);
    expect(suiteSetProblems(LOCKSTEP.slice(1))).toEqual(['scripts/restraint-matrix.mjs: lockstep file unchanged']);

    if (!BASE) return;
    const changed = changedSince(BASE);
    const problems = suiteSetProblems(changed);
    // The after-state is the working tree (as changedSince reads it), so an uncommitted edit cannot slip past.
    const now = (file: string) => readFileSync(join(REPO, file), 'utf8');
    const report: string[] = ['MP-26 AC18: lockstep amendments', `base: ${git('rev-parse', BASE).trim()}`, `head: ${git('rev-parse', 'HEAD').trim()} (working tree read)`, ''];
    const numstat = Object.fromEntries(lines(git('diff', '--numstat', BASE, '--', ...LOCKSTEP)).map((l) => { const [a, d, f] = l.split('\t'); return [f, { added: Number(a), removed: Number(d) }]; }));
    for (const file of LOCKSTEP) {
      const before = git('show', `${BASE}:${file}`);
      const after = now(file);
      problems.push(...amendmentProblems(file, before, after));
      const [cb, ca] = [ceilings(before), ceilings(after)];
      const moved = Object.keys({ ...cb, ...ca }).filter((k) => cb[k] !== ca[k]).map((k) => `${k} ${cb[k] ?? '-'} -> ${ca[k] ?? '-'}`);
      report.push(`${file}: +${numstat[file]?.added ?? 0} -${numstat[file]?.removed ?? 0}; it( ${itCount(before)} -> ${itCount(after)}${moved.length ? `; ceilings: ${moved.join(', ')}` : ''}`);
    }
    // The gold ceiling goes down by exactly one (44 -> 43).
    const gold = ceilings(now('tests/restraint/restraint.gold.test.ts')).GOLD_TOTAL_CEILING;
    const goldBase = ceilings(git('show', `${BASE}:tests/restraint/restraint.gold.test.ts`)).GOLD_TOTAL_CEILING;
    if (gold !== goldBase - 1 || gold !== 43) problems.push(`GOLD_TOTAL_CEILING ${goldBase} -> ${gold}, expected 44 -> 43`);
    const suiteFiles = changed.filter(inSuites);
    report.push('', `changed files under tests/restraint/, tests/design/, scripts/restraint-matrix.mjs (${suiteFiles.length}):`, ...suiteFiles.map((p) => `  ${p}`), '', `GOLD_TOTAL_CEILING: ${goldBase} -> ${gold}`, `problems: ${problems.length}`, ...problems.map((p) => `  ${p}`), '');
    if (EVIDENCE) {
      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, 'AC18-amendment-diff.txt'), report.join('\n'));
    }
    expect(problems).toEqual([]);
  });
});
