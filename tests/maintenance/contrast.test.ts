// MP-37 AC11: the wall's colours are the repo's tone values, every text colour is recomputed against
// the ground (body text at least 7:1, everything else at least 4.5:1), and no text is smaller than
// 0.875rem (body at least 1rem, heading larger, link underlined). Ratios are computed, not typed in.
import { describe, expect, it } from 'vitest';
import { tone } from '@/components/browse/tokens';
import { renderWallHtml } from '@/domain/maintenance/wall';
import { contrast } from '../restraint/restraintScan';
import { cssRules, styleOf } from './helpers';

const ALLOWED = { ground: tone.ground, ink: tone.ink, muted: tone.muted, gold: tone.gold };

function toneProblems(css: string): string[] {
  const used = Array.from(new Set(Array.from(css.matchAll(/#[0-9a-fA-F]{3,8}\b/g), (m) => m[0])));
  const p = used.filter((h) => !Object.values(ALLOWED).includes(h as never)).map((h) => `colour ${h} is not ground, ink, muted or gold`);
  for (const [name, hex] of Object.entries(ALLOWED)) if (!used.includes(hex)) p.push(`${name} ${hex} unused`);
  if (/\b(dim|dim2)\b/.test(css) || used.includes(tone.dim) || used.includes(tone.dim2)) p.push('uses dim');
  return p;
}

/** Text colour per rule against the body ground; body text 7:1, others 4.5:1. */
function contrastPairs(css: string) {
  const rules = cssRules(css);
  const ground = rules.find((r) => r.selector === 'body')?.decls.background ?? '';
  return rules
    .filter((r) => r.decls.color)
    .map((r) => {
      const isBody = r.selector === 'body' || r.selector === 'p';
      const ratio = contrast(r.decls.color, ground);
      return { selector: r.selector, fg: r.decls.color, bg: ground, ratio, min: isBody ? 7 : 4.5 };
    });
}
const contrastProblems = (css: string) =>
  contrastPairs(css).filter((x) => !(x.ratio >= x.min)).map((x) => `${x.selector} ${x.fg} on ${x.bg} is ${x.ratio.toFixed(2)}:1 (needs ${x.min}:1)`);

const rem = (v: string) => (v.endsWith('rem') ? parseFloat(v) : v.endsWith('px') ? parseFloat(v) / 16 : NaN);

function sizeProblems(css: string): string[] {
  const rules = cssRules(css);
  const p: string[] = [];
  for (const r of rules) {
    const fs = r.decls['font-size'];
    if (fs !== undefined && !(rem(fs) >= 0.875)) p.push(`${r.selector} font-size ${fs} is under 0.875rem`);
  }
  const size = (sel: string) => rem(rules.find((r) => r.selector === sel)?.decls['font-size'] ?? 'x');
  if (!(size('body') >= 1)) p.push('body text under 1rem');
  if (!(size('p') >= 1)) p.push('paragraph text under 1rem');
  if (!(size('h1') > size('body'))) p.push('heading not larger than body');
  if (!/underline/.test(rules.find((r) => r.selector === 'a')?.decls['text-decoration'] ?? '')) p.push('link not underlined');
  return p;
}

describe('MP-37 wall contrast and legibility', () => {
  const css = styleOf(renderWallHtml({ backBy: '' }));

  it('page colours equal the repo tone values', () => {
    // Planted: a colour one digit off the gold token is reported.
    const off = css.split(tone.gold).join('#C8A665');
    expect(toneProblems(off)).toEqual(['colour #C8A665 is not ground, ink, muted or gold', `gold ${tone.gold} unused`]);
    expect(toneProblems(css)).toEqual([]);
  });

  it('body text contrast is at least 7:1 and every other text at least 4.5:1', () => {
    // Planted: the old muted grey (3.30:1) as body text is reported.
    expect(contrastProblems(css.replace(/body\{([^}]*)color:#[0-9a-fA-F]{6}/, 'body{$1color:#5C6272'))).toEqual(['body #5C6272 on #06070a is 3.30:1 (needs 7:1)']);
    const pairs = contrastPairs(css);
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(pairs.every((x) => x.bg === tone.ground)).toBe(true);
    expect(contrastProblems(css)).toEqual([]);
    console.log(`contrast pairs:\n${pairs.map((x) => `${x.selector}: ${x.fg} on ${x.bg} = ${x.ratio.toFixed(2)}:1 (min ${x.min}:1)`).join('\n')}`);
  });

  it('no text is smaller than 0.875rem and body text is at least 1rem', () => {
    // Planted: an 11px size is reported.
    expect(sizeProblems(`${css}.small{font-size:11px}`)).toEqual(['.small font-size 11px is under 0.875rem']);
    expect(sizeProblems(css)).toEqual([]);
  });
});
