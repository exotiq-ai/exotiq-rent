// MP-17 frame tests: the booking frame (`PhoneViewport` / `BookingChrome`) and `PageFrame`.
// AC14 is a golden comparison: the panel frame (header row, frame and wrapper classes, children
// slot, the lg rail) rendered at the branch base efff2bb, with only the step indicator cut out,
// must stay byte-identical after this ticket. The golden is recorded from the base BEFORE the
// first source edit; the provenance check below proves the order from git history.
//
// Recording (base only): MP17_RECORD_GOLDEN=1 npx vitest run tests/chrome/chrome.frame.test.tsx
// The recorder never overwrites the golden and refuses to run once any non-test path has changed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { classes, elements, hasClass, parseHtml } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const GOLDEN = fileURLToPath(new URL('./golden/panel-frame.base.json', import.meta.url));
const GOLDEN_REL = 'tests/chrome/golden/panel-frame.base.json';
/** The branch base: main after MP-15, MP-16 and MP-26 merged. */
const BASE_SHA = 'efff2bbce843ab29be5f7a07ddaf4bf0bfe57fb3';
const git = (...args: string[]): string => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
const lines = (out: string) => out.split('\n').map((l) => l.trim()).filter(Boolean);
/** What "a source edit" means for the recording rule: anything outside tests/. */
const isSource = (p: string) => !p.startsWith('tests/');
const noop = () => {};

// Props that change in this ticket go through a loose type, so the base and the change both compile.
const Frame = PhoneViewport as unknown as ComponentType<Record<string, unknown>>;
const renderFrame = (props: Record<string, unknown>, children: ReactNode) =>
  renderToStaticMarkup(createElement(Frame, { layout: 'panel', className: 'font-[var(--font-drive-inter)]', ...props }, children));

/** AC14 cases: what the base was rendered with, and what the same caller passes after this ticket. */
const CASES: Record<string, { base: Record<string, unknown>; now: Record<string, unknown>; stepped: boolean }> = {
  'step2-plain': { base: { step: 2, closeHref: '/exotiq' }, now: { step: 2, closeHref: '/exotiq' }, stepped: true },
  'step3-back-rail': { base: { step: 3, onBack: noop, rail: <p data-probe>rail</p> }, now: { step: 3, onBack: noop, rail: <p data-probe>rail</p> }, stepped: true },
  // The full confirmation passed step={6} at the base; after this ticket it passes no step.
  'confirmation-full': { base: { step: 6, closeHref: '/exotiq' }, now: { closeHref: '/exotiq' }, stepped: false },
  // The restricted confirmation: step={6} and no closeHref at the base; nothing after.
  'confirmation-restricted': { base: { step: 6 }, now: {}, stepped: false },
};
const child = <p data-probe>child</p>;

/**
 * The panel frame split at the step indicator: `cut` is everything between the end of the header
 * row and the start of the children wrapper (the strip at the base, the progress after), and
 * `without` is the whole render with that range removed. No whitespace normalisation.
 */
export function splitProgress(html: string): { without: string; cut: string } {
  const root = parseHtml(html);
  const row = elements(root).find((e) => e.tag === 'div' && hasClass(e, 'grid', 'flex-shrink-0', 'grid-cols-[40px_1fr_40px]'));
  const wrap = elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === 'flex min-h-0 flex-1 flex-col');
  if (!row || !wrap) throw new Error('panel header row or children wrapper not found');
  if (wrap.start < row.end) throw new Error('children wrapper precedes the header row');
  return { without: html.slice(0, row.end) + html.slice(wrap.start), cut: html.slice(row.end, wrap.start) };
}

type Golden = { baseSha: string; recordedAt: string; recordedOn: string; cases: Record<string, { without: string }>; cutAtBase: Record<string, string> };

describe('MP-17 AC14 golden (recorded from the base)', () => {
  it.skipIf(!process.env.MP17_RECORD_GOLDEN)('records the panel-frame golden before any source edit (MP17_RECORD_GOLDEN, never overwrites)', () => {
    const committed = lines(git('diff', '--name-only', BASE_SHA, 'HEAD')).filter(isSource);
    const dirty = lines(git('status', '--porcelain')).map((l) => l.slice(3)).filter(isSource);
    expect([...committed, ...dirty], 'the golden must be recorded from the unchanged base').toEqual([]);
    expect(existsSync(GOLDEN), 'the golden exists already; it is never overwritten').toBe(false);
    const golden: Golden = { baseSha: BASE_SHA, recordedAt: git('rev-parse', 'HEAD'), recordedOn: new Date().toISOString(), cases: {}, cutAtBase: {} };
    for (const [name, c] of Object.entries(CASES)) {
      const { without, cut } = splitProgress(renderFrame(c.base, child));
      golden.cases[name] = { without };
      golden.cutAtBase[name] = cut;
    }
    mkdirSync(join(GOLDEN, '..'), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(golden, null, 1)}\n`);
  });
});

describe('MP-17 frame', () => {
  it('flow header row and frame are byte-identical outside the progress', () => {
    const problems: string[] = [];
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Golden;

    // Provenance: recorded from the base, and committed before the first source edit since it.
    if (golden.baseSha !== BASE_SHA) problems.push(`golden base ${golden.baseSha} is not ${BASE_SHA}`);
    try { git('merge-base', '--is-ancestor', BASE_SHA, 'HEAD'); } catch { problems.push('the base is not an ancestor of HEAD'); }
    const goldenCommit = lines(git('log', '--diff-filter=A', '--format=%H', '--', GOLDEN_REL)).pop() ?? '';
    if (!goldenCommit) problems.push('the golden is not committed');
    const firstSource = lines(git('rev-list', '--reverse', `${BASE_SHA}..HEAD`)).find((sha) => lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', sha)).some(isSource));
    if (goldenCommit && firstSource) {
      if (goldenCommit === firstSource) problems.push('the golden landed in the same commit as a source edit');
      else try { git('merge-base', '--is-ancestor', goldenCommit, firstSource); } catch { problems.push(`golden commit ${goldenCommit.slice(0, 7)} is not an ancestor of the first source commit ${firstSource.slice(0, 7)}`); }
    }

    // Re-render with today's props and compare byte for byte, naming where it moved.
    for (const [name, c] of Object.entries(CASES)) {
      const want = golden.cases[name]?.without;
      if (want === undefined) { problems.push(`${name}: no golden`); continue; }
      const { without, cut } = splitProgress(renderFrame(c.now, child));
      if (without !== want) {
        let i = 0;
        while (i < without.length && without[i] === want[i]) i++;
        problems.push(`${name}: differs at ${i}: base "…${want.slice(Math.max(0, i - 60), i + 60)}…" now "…${without.slice(Math.max(0, i - 60), i + 60)}…"`);
      }
      // Positive control: the cut is the indicator, so a stepped panel always has one to cut.
      if (c.stepped && cut.length === 0) problems.push(`${name}: nothing between the header row and the wrapper (the cut found no indicator)`);
    }

    // Planted: one class added to the header row is caught by the same comparison.
    const planted = golden.cases['step2-plain'].without.replace('grid flex-shrink-0', 'grid gap-1 flex-shrink-0');
    expect(planted).not.toBe(golden.cases['step2-plain'].without);

    expect(problems).toEqual([]);
  });
});
