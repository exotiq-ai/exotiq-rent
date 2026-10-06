// MP-33 AC8(d): the branch touches only its named paths. Runs only where MP33_BASE_REF names the cut
// commit (the commit MP-30's merge produced, which the branch was cut from); unset, it skips, like the
// other diff-proof suites. Set but unusable (no git, an unknown ref) it fails loudly.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../design/lib/scan.mjs';

const BASE = process.env.MP33_BASE_REF;
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args: string[]): string => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (out: string) => out.split('\n').map((l) => l.trim()).filter(Boolean);
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** The sixteen paths of the diff at the post-MP-30 cut. The golden set is amended by a driver erratum, never guessed. */
const GOLDENS = ['review-FX-T1S1P0.html', 'review-FX-T1S1P1-requesting.html', 'review-FX-T1S1P1.html', 'review-mock-no-quote.html'].map((n) => `tests/protect/golden/${n}`);
const ALLOWED = [
  'app/terms/page.tsx',
  'components/browse/TermsDocument.tsx',
  'domain/legal/termsMarkdown.ts',
  'domain/legal/termsV2.ts',
  'tests/legal/terms.faithfulness.test.ts',
  'tests/legal/terms.page.test.tsx',
  'tests/legal/terms.scope.test.ts',
  'components/drive-exotiq/flow/ReviewStep.tsx',
  'components/browse/BrowseChrome.tsx',
  'components/drive-exotiq/flow/ReviewStep.terms.test.tsx',
  'domain/booking/tracking-pages.test.ts',
  ...GOLDENS,
  'tests/protect/golden/base.json',
].sort();

/** The label span and the hint, the two hunks every Review golden moves by (each matches exactly once). */
const H1: [string, string] = [
  '<span class="text-ink underline decoration-faint underline-offset-2">Rental Terms &amp; Conditions</span>',
  '<a href="/terms" target="_blank" rel="noopener noreferrer" aria-describedby="review-terms-new-tab" class="text-ink underline decoration-faint underline-offset-2">Rental Terms &amp; Conditions</a>',
];
const H2: [string, string] = [
  '</label><p id="review-terms-status"',
  '</label><span id="review-terms-new-tab" class="sr-only">(opens in a new tab)</span><p id="review-terms-status"',
];
const once = (text: string, from: string, to: string): string => {
  expect(text.split(from).length - 1, `expected exactly one ${from.slice(0, 60)}`).toBe(1);
  return text.replace(from, () => to);
};

/** Added and removed lines between two texts (git's own diff), ignoring blank lines and bare comment shells. */
function changedLines(a: string, b: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'mp33-'));
  writeFileSync(join(dir, 'a'), a);
  writeFileSync(join(dir, 'b'), b);
  let out = '';
  try {
    out = execFileSync('git', ['diff', '--no-index', '--no-color', '-U0', '--', 'a', 'b'], { cwd: dir, encoding: 'utf8' });
  } catch (e) {
    out = (e as { stdout?: string }).stdout ?? '';
    if (!out) throw e;
  }
  return out.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).map((l) => l.slice(1)).filter((l) => l.trim() !== '' && l.trim() !== '{}');
}
const MENTIONS = /browseEnabled|\/terms|Rental Terms|review-terms-new-tab/;
const titles = (text: string) => Array.from(text.matchAll(/^\s*it\(\s*'([^']+)'/gm), (m) => m[1]).sort();

describe('MP-33 touches only its named files', () => {
  it.skipIf(!BASE)('the diff against the cut is exactly the sixteen paths, with only the named hunks', () => {
    git('rev-parse', '--verify', `${BASE}^{commit}`); // an unusable ref fails loudly here
    const changed = new Set([...lines(git('diff', '--no-renames', '--name-only', BASE as string)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
    expect(Array.from(changed).sort()).toEqual(ALLOWED);

    // The two source files: comments stripped, only lines that mention the link and its gate move.
    for (const rel of ['components/drive-exotiq/flow/ReviewStep.tsx', 'components/browse/BrowseChrome.tsx']) {
      const before = stripComments(git('show', `${BASE}:${rel}`));
      const after = stripComments(read(rel));
      const moved = changedLines(before, after);
      expect(moved.length, `${rel}: positive control, the hunk exists`).toBeGreaterThan(0);
      expect(moved.filter((l) => !MENTIONS.test(l)), rel).toEqual([]);
      // Teeth: one stray line is caught by the same filter.
      expect(changedLines(before, `${after}\nconst stray = 1;`).filter((l) => !MENTIONS.test(l))).toEqual(['const stray = 1;']);
    }
    // ReviewStep no longer imports the gate; BrowseChrome still does (home link and saved link).
    expect(read('components/drive-exotiq/flow/ReviewStep.tsx')).not.toContain('browseEnabled');
    expect(read('components/browse/BrowseChrome.tsx')).toContain("import { browseEnabled } from '@/domain/booking/config';");

    // The goldens: the old bytes with exactly the two substitutions applied are the new bytes (the files are one line each).
    for (const rel of GOLDENS) {
      const before = git('show', `${BASE}:${rel}`);
      expect(read(rel), rel).toBe(once(once(before, ...H1), ...H2));
    }
    // base.json: exactly four values changed, each the new golden's sha256; everything else byte-identical.
    const oldBase = JSON.parse(git('show', `${BASE}:tests/protect/golden/base.json`));
    const newText = read('tests/protect/golden/base.json');
    const newBase = JSON.parse(newText);
    expect(newText).toBe(`${JSON.stringify(newBase, null, 1)}\n`);
    expect({ ...newBase, files: undefined }).toEqual({ ...oldBase, files: undefined });
    expect(Object.keys(newBase.files)).toEqual(Object.keys(oldBase.files));
    const differing = Object.keys(oldBase.files).filter((k) => oldBase.files[k] !== newBase.files[k]).sort();
    expect(differing).toEqual(GOLDENS.map((g) => g.split('/').pop() as string).sort());
    for (const k of differing) expect(newBase.files[k], k).toBe(sha(read(`tests/protect/golden/${k}`)));

    // The two amended pins: same number of tests, exactly the one pair renamed or rewritten in each.
    const pairs: [string, string, string][] = [
      ['components/drive-exotiq/flow/ReviewStep.terms.test.tsx', 'terms label is plain text when legal pages are not published', 'terms label is the same new tab link on every host, browse on or off'],
      ['domain/booking/tracking-pages.test.ts', 'does not let the legal page link to unavailable browse and terms pages', 'links the legal page to terms on every host and to browse only where browse exists'],
    ];
    for (const [rel, gone, added] of pairs) {
      const before = titles(git('show', `${BASE}:${rel}`));
      const after = titles(read(rel));
      expect(after.length, rel).toBe(before.length);
      expect(before.filter((t) => !after.includes(t)), rel).toEqual([gone]);
      expect(after.filter((t) => !before.includes(t)), rel).toEqual([added]);
    }
  });
});
