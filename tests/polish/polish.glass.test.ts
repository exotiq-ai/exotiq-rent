// MP-25 AC6, AC7: one glass recipe, worn only by the site bar, legible over white; the bar either
// materializes on scroll or wears the frost throughout. Source scans, the contrast arithmetic, and the real
// PostCSS pipeline (tailwindcss then autoprefixer: tests/design compileWith skips autoprefixer and would
// pass falsely, locate finding 1). The BUILT css is read when MP25_BUILT_CSS_DIR names a build's css
// directory (driver errata 1: the binding read; the evidence step sets it). Computed styles, reduced
// transparency and the scroll threshold are scripts/polish-probe.mjs's (evidence AC6, AC7).
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as tokens from '@/components/browse/tokens';
import config from '../../tailwind.config';
import { stripComments } from '../design/lib/scan.mjs';
import { contrast, mix, openTags, prepare } from '../restraint/restraintScan';
import {
  CSS, REPO, SITEBAR, TOKENS, PROJECT, alphaOf, barTextTones, baseCensus, blurOf, builtCss, glassLines, glassSites, read, recipeProblems, sourceFiles, withoutFence,
} from './polishBase';

const recipeOf = (): string | null => {
  const r = (tokens as Record<string, unknown>).glassBarClassName;
  return typeof r === 'string' ? r : null;
};

describe('MP-25 glass', () => {
  it('one glass recipe worn only by the site bar and legible over white', async () => {
    const problems: string[] = [];
    const recipe = recipeOf();
    if (!recipe) {
      expect(['components/browse/tokens.ts exports no glassBarClassName']).toEqual([]);
      return;
    }
    const css = read(CSS);
    // 1. The recipe and its hand-written Safari twin (planted: an 85% recipe and a twin at another blur are seen).
    if (!recipeProblems(recipe.replace(/bg-ground\/\S+/, 'bg-ground/85'), css).length) problems.push('planted: an 85% recipe passes');
    if (!recipeProblems(recipe, css.replace('-webkit-backdrop-filter: blur(', '-webkit-backdrop-filter: blur(2')).length) problems.push('planted: a twin at another blur passes');
    problems.push(...recipeProblems(recipe, css));
    // 2. Contrast: every text tone the bar can render, over the bar composited on white (D4).
    const tones = barTextTones();
    for (const t of ['faint', 'muted', 'ink']) if (!tones.includes(t)) problems.push(`the bar's text scan misses text-${t}`);
    const over = (alpha: number) => tones.map((t) => [t, contrast(tokens.tone[t as keyof typeof tokens.tone], mix(tokens.tone.ground, '#ffffff', alpha))] as const);
    if (over(0.85).every(([, r]) => r >= 4.5)) problems.push('planted: the 85% bar passes the floor (the faint tagline is 4.04:1 there)');
    for (const [t, r] of over(alphaOf(recipe))) if (r < 4.5) problems.push(`text-${t} over the bar on white: ${r.toFixed(2)}:1`);
    // 3. One consumer; no other glass anywhere under app/ and components/.
    const holders = (needle: string) => sourceFiles().filter((r) => prepare(r, read(r)).includes(needle));
    if (JSON.stringify(holders('glassBarClassName')) !== JSON.stringify([SITEBAR, TOKENS])) problems.push(`glassBarClassName appears in ${holders('glassBarClassName').join(', ')}`);
    if (JSON.stringify(holders('glass-bar-twin')) !== JSON.stringify([CSS, TOKENS])) problems.push(`glass-bar-twin appears in ${holders('glass-bar-twin').join(', ')}`);
    const base = baseCensus().glass;
    const now = glassSites();
    // The five over-photo sites (ConfirmationScreen's Reserved badge is an allowed exception, errata 2) stay byte-identical.
    for (const file of Array.from(new Set([...Object.keys(base), ...Object.keys(now)]))) {
      if (file === SITEBAR || file === TOKENS || file === CSS) continue;
      if (JSON.stringify(now[file] ?? []) !== JSON.stringify(base[file] ?? [])) problems.push(`${file}: backdrop sites changed: ${JSON.stringify(now[file] ?? [])}`);
    }
    if (now[SITEBAR]) problems.push('SiteBar writes its own backdrop utility instead of wearing the recipe');
    if (glassLines(prepare(TOKENS, PROJECT[TOKENS](read(TOKENS)))).length) problems.push('a backdrop utility in tokens.ts outside glassBarClassName');
    if (JSON.stringify(glassLines(prepare(CSS, withoutFence(css)))) !== JSON.stringify(base[CSS] ?? [])) problems.push('a backdrop filter in globals.css outside the polish fence');
    if (/backdrop/.test(tokens.stickyBarClassName)) problems.push('the phone bar recipe carries a backdrop utility');
    // 4. The real pipeline keeps both properties; planted: without the twin rule the check sees no twin.
    const { default: postcss } = await import('postcss');
    const { default: tailwindcss } = await import('tailwindcss');
    const { default: autoprefixer } = await import('autoprefixer');
    const pipeline = async (text: string) =>
      (await postcss([tailwindcss({ ...config, content: [{ raw: `${recipe} ${read(SITEBAR)}`, extension: 'html' }] }), autoprefixer()]).process(text, { from: join(REPO, CSS) })).css;
    const twin = (out: string) => new RegExp(`\\.glass-bar-twin\\s*\\{[^}]*-webkit-backdrop-filter:\\s*blur\\(${blurOf(recipe)}px\\)`).test(out);
    const unprefixed = (out: string) => /\.backdrop-blur-(?:md|lg|xl)\s*\{[^}]*[^-]backdrop-filter:/.test(out);
    if (twin(await pipeline(css.replace(/ {2}\.glass-bar-twin \{[^}]*\}\n/, '')))) problems.push('planted: a missing twin rule is not seen');
    const out = await pipeline(css);
    if (!twin(out)) problems.push('the PostCSS output (tailwindcss then autoprefixer) has no -webkit-backdrop-filter twin');
    if (!unprefixed(out)) problems.push('the PostCSS output has no unprefixed backdrop-filter');
    // 5. The built CSS, when named (errata 1): both properties in what ships.
    const dir = process.env.MP25_BUILT_CSS_DIR;
    if (dir) {
      const shipped = builtCss(dir).replace(/\s+/g, '');
      if (!new RegExp(`\\.glass-bar-twin\\{[^}]*-webkit-backdrop-filter:blur\\(${blurOf(recipe)}px\\)`).test(shipped)) problems.push(`${dir}: the built CSS has no -webkit-backdrop-filter twin`);
      if (!/\.backdrop-blur-(?:md|lg|xl)\{[^}]*[;{]backdrop-filter:/.test(shipped)) problems.push(`${dir}: the built CSS has no unprefixed backdrop-filter`);
    }
    expect(problems).toEqual([]);
  });

  it('the site bar is either clear at the top and frosted once scrolled or frosted throughout', () => {
    const problems: string[] = [];
    const src = stripComments(read(SITEBAR));
    const header = openTags(src, 'header')[0] ?? '';
    // Either way the condense is unchanged: threshold 24, 64px to 48px.
    for (const needle of ['window.scrollY > 24', "condensed ? 'h-12' : 'h-16'", 'transition-[height] duration-300 motion-reduce:transition-none']) if (!src.includes(needle)) problems.push(`the condense changed: ${needle}`);
    if (!header.includes('sticky top-0 z-40 border-b ')) problems.push(`header: ${header}`);
    if (/condensed \? glassBarClassName/.test(header)) {
      const clear = /condensed \? glassBarClassName : '([^']*)'/.exec(header)?.[1] ?? '';
      for (const t of ['border-transparent', 'bg-transparent', 'backdrop-blur-none']) if (!clear.split(/\s+/).includes(t)) problems.push(`the clear state lacks ${t}`);
      if (/glass-bar-twin|bg-ground|border-line/.test(clear)) problems.push('the clear state carries frost');
      const dur = /(?:^|\s)transition-colors duration-(\d+) motion-reduce:transition-none(?:\s|$)/.exec(header)?.[1];
      if (!dur || Number(dur) < 150 || Number(dur) > 300) problems.push(`materialize transition ${dur ?? 'missing'} (colours only, 150-300ms)`);
      if (/(?:^|\s)transition(?:-all|-\[[^\]]*\])?(?:\s|$)/.test(header)) problems.push('materialize transitions more than colours (the blur switches at once)');
    } else if (!/<header className=\{`sticky top-0 z-40 border-b \$\{glassBarClassName\} \$\{className\}`\}>/.test(header)) problems.push('not built, and the bar does not wear the recipe at every scroll position');
    expect(problems).toEqual([]);
  });
});
