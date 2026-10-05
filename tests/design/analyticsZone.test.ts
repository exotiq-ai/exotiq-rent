// MP-15 analytics zone (AC18 a-c, driver addendum D10 / P6 / R11). components/analytics/** is
// compliance-bearing shipped work. CookieControls.tsx may differ from the pre-MP-15 base ONLY by
// renames of its six tone-valued colours, proven by construction: undo the renames and the file
// is byte-identical; each renamed utility compiles to the same CSS as its bracket twin.
// Two kinds of test (SP1): the compile-twin and the shipped literals hold forever and always run;
// the byte reversal diffs against the pre-MP-15 base, so it runs only with MP15_BASE_REF set.
// (Part d, the rendered subtree, is in visualProof.test.ts; part e is the analytics suite itself.)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { BASE_REF, BASE_REF_SKIP_NOTE, compileWith, git, mergeBase, showAt } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const FILE = 'components/analytics/CookieControls.tsx';
const read = () => readFileSync(path.join(root, FILE), 'utf8');

// The six tone-valued colours R11 renames, mapped back to the literal the pre-MP-15 file carries.
const RENAMED: Record<string, string> = {
  goldInk: '#1A1308', gold: '#C8A664', muted: '#9BA1B0', surface: '#161922', ink: '#F0F2F5', line: '#2A2E3A',
};
// <variants><util>-<token>, token not followed by more name characters (gold never eats goldInk).
const NAMED = /(?<![A-Za-z0-9_-])((?:[a-z0-9_\-[\]&:>*=]+:)*)(bg|text|border(?:-[trblxy])?|outline|ring(?:-offset)?|divide|fill|stroke|decoration|from|via|to|accent|caret)-(goldInk|gold|muted|surface|ink|line)(?![A-Za-z0-9_-])/g;

const inverseRename = (source: string) => source.replace(NAMED, (_m, variants: string, util: string, token: string) => `${variants}${util}-[${RENAMED[token]}]`);

/** Line diff, empty when identical. */
function lineDiff(base: string, now: string): string {
  const a = base.split('\n'), b = now.split('\n');
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) out.push(`-${i + 1}: ${a[i] ?? '(none)'}`, `+${i + 1}: ${b[i] ?? '(none)'}`);
  }
  return out.join('\n');
}

describe('MP-15 analytics zone', () => {
  it('CookieControls renamed colours compile to their bracket-hex twins and its own literals stay as shipped', async () => {
    const now = read();

    // (c) every renamed utility compiles to the same declarations as its bracket-hex twin.
    const renamed = Array.from(new Set(Array.from(now.matchAll(NAMED)).map((m) => {
      const after = now.slice((m.index ?? 0) + m[0].length).match(/^\/[0-9]+/);
      return m[0] + (after ? after[0] : '');
    })));
    expect(renamed.length).toBeGreaterThan(0);
    const twin = (cls: string) => inverseRename(cls.replace(/\/[0-9]+$/, '')) + (cls.match(/\/[0-9]+$/)?.[0] ?? '');
    const { decls } = await compileWith(config, [...renamed, ...renamed.map(twin)]);
    const differ = renamed
      .filter((cls) => decls(cls).length === 0 || JSON.stringify(decls(cls)) !== JSON.stringify(decls(twin(cls))))
      .map((cls) => `${cls} {${decls(cls).join(';')}} != ${twin(cls)} {${decls(twin(cls)).join(';')}}`);
    expect(differ).toEqual([]);

    // The zone's own palette and type stay literal (D10): the five analytics-only colours, once each,
    // and the ten type literals (10px x2, 11px x4, 12px x3, 14px x1).
    const count = (re: RegExp) => Array.from(now.matchAll(re)).length;
    expect(Object.fromEntries(['#465064', '#252B38', '#CDD1D9', '#353B49', '#0008'].map((h) => [h, count(new RegExp(`${h}(?![0-9A-Fa-f])`, 'g'))])))
      .toEqual({ '#465064': 1, '#252B38': 1, '#CDD1D9': 1, '#353B49': 1, '#0008': 1 });
    expect(Object.fromEntries(['10', '11', '12', '14'].map((px) => [px, count(new RegExp(`text-\\[${px}px\\]`, 'g'))])))
      .toEqual({ 10: 2, 11: 4, 12: 3, 14: 1 });
  });
});

describe.skipIf(!BASE_REF)(`MP-15 analytics zone (${BASE_REF_SKIP_NOTE})`, () => {
  it('CookieControls differs from the merge-base only by tone-color renames', () => {
    const base = mergeBase(root);

    // (a) every other analytics file, the QA scripts, the analytics docs and the two tracking tests: byte-identical.
    const frozen = ['components/analytics', 'scripts', 'docs/analytics', 'domain/booking/tracking-pages.test.ts', 'domain/booking/analytics-ingestion.test.ts'];
    const changed = [
      ...git(root, ['diff', '--name-only', base, '--', ...frozen]).split('\n'),
      ...git(root, ['ls-files', '--others', '--exclude-standard', '--', ...frozen]).split('\n'),
    ].filter(Boolean);
    expect(changed.filter((file) => file !== FILE)).toEqual([]);

    // (b) undo the renames: the result must be the base file, byte for byte.
    const now = read();
    const merged = showAt(root, base, FILE);
    const diff = lineDiff(merged, inverseRename(now));
    if (process.env.MP15_EVIDENCE_DIR) writeFileSync(path.join(process.env.MP15_EVIDENCE_DIR, 'analytics-zone.txt'), diff);
    expect(diff).toBe('');
    expect(inverseRename(now) === merged).toBe(true);
  });
});
