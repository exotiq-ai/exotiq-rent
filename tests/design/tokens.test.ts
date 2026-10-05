// MP-15 token sources: one palette (`tone`), imported by Tailwind, mirrored once in CSS,
// and one serif recipe. AC1, AC2, AC3, AC12.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { BASE_REF, BASE_REF_SKIP_NOTE, HEX, URLHEX, compileWith, mergeBase, scan, showAt, stripComments } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const tone = tokens.tone as Record<string, string>;

// AC1: the 14 contract colours + the 5 residual tokens, at today's values (compared case-insensitively).
const EXPECTED_TONE: Record<string, string> = {
  ground: '#06070A', panel: '#0D0F14', surface: '#161922', surface2: '#1E2230', field: '#10131A',
  line: '#2A2E3A', line2: '#3A3F4D', ink: '#F0F2F5', muted: '#9BA1B0', faint: '#848A9A',
  gold: '#C8A664', goldInk: '#1A1308', verified: '#6EC1E4', warn: '#FFB84D',
  goldWash: '#14130F', shareGround: '#0B0D12', dim: '#3D4250', dim2: '#5C6272', inkSoft: '#D7DAE0',
};
// AC13 lets these four referenced legacy colours live in a commented LEGACY group.
const LEGACY_COLORS = ['deep-black', 'pure-white', 'jet-grey', 'graphite'];

/** The spec's kebab rule: surface2 -> surface-2, goldInk -> gold-ink. */
const kebab = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

function exportedFunction(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  if (start < 0) throw new Error(`export function ${name} not found`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

/** `selector { ... }` up to its closing brace. */
function ruleText(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  return css.slice(start, css.indexOf('}', start) + 1);
}

describe('MP-15 token sources', () => {
  it('tone holds the 14 contract tokens and the 5 residual tokens at their baseline values', () => {
    const actual = Object.fromEntries(Object.entries(tone).map(([key, value]) => [key, String(value).toUpperCase()]));
    expect(actual).toEqual(EXPECTED_TONE);
    expect(Object.keys(tone)).not.toContain('danger');
  });

  it('tailwind theme colors are the tone palette, imported not retyped, and compile to the same CSS as their bracket-hex twins', async () => {
    const source = read('tailwind.config.ts');
    expect(source).toMatch(/import \{ tone \} from ['"]\.\/components\/browse\/tokens['"]/);
    const outsideLegacy = stripComments(source.replace(/\/\*\s*LEGACY:begin[\s\S]*?LEGACY:end\s*\*\//g, ''));
    expect(Array.from(outsideLegacy.matchAll(HEX)).map((m) => m[0])).toEqual([]);

    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    const missing = Object.keys(tone).filter((key) => colors[key] !== tone[key]);
    expect(missing).toEqual([]);
    expect(Object.keys(colors).filter((key) => !(key in tone) && !LEGACY_COLORS.includes(key))).toEqual([]);

    const pairs: [string, string][] = [];
    for (const [key, value] of Object.entries(tone)) {
      for (const util of ['bg', 'text', 'border', 'ring', 'outline']) {
        for (const alpha of ['', '/60']) pairs.push([`${util}-${key}${alpha}`, `${util}-[${value}]${alpha}`]);
      }
    }
    const sample = ['bg-ground', 'ring-gold/60', 'border-line2', 'text-goldInk', 'placeholder:text-faint'];
    const { css, decls } = await compileWith(config, [...pairs.flat(), ...sample]);
    const differ = pairs
      .filter(([named, bracket]) => decls(named).length === 0 || JSON.stringify(decls(named)) !== JSON.stringify(decls(bracket)))
      .map(([named, bracket]) => `${named} {${decls(named).join(';')}} != ${bracket} {${decls(bracket).join(';')}}`);
    expect(differ).toEqual([]);
    expect(css).toContain('rgb(6 7 10 /');
    expect(css).toContain('rgb(200 166 100 / 0.6)');
  });

  it('globals.css var block mirrors tone and leaves the focus ring and the check-tick colour untouched', () => {
    const css = read('app/globals.css');
    const begins = css.split('/* tone-mirror:begin */').length - 1;
    const ends = css.split('/* tone-mirror:end */').length - 1;
    expect({ begins, ends }).toEqual({ begins: 1, ends: 1 });

    const block = css.slice(css.indexOf('/* tone-mirror:begin */'), css.indexOf('/* tone-mirror:end */'));
    expect(block).toMatch(/:root\s*\{/);
    const vars = Object.fromEntries(Array.from(block.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)).map((m) => [m[1], m[2].trim().toUpperCase()]));
    const expected = Object.fromEntries(Object.entries(tone).map(([key, value]) => [`--tone-${kebab(key)}`, value.toUpperCase()]));
    expect(vars).toEqual(expected);

    // The a11y signature: both focus-ring rules declare exactly the shipped ring, nothing else.
    // (Their byte identity with the pre-MP-15 file is the MP15_BASE_REF-gated test below.)
    for (const selector of [':-moz-focusring', ':where(*:focus-visible)']) {
      const body = ruleText(css, selector);
      const declarations = body.slice(body.indexOf('{') + 1, body.lastIndexOf('}')).split(';').map((d) => d.trim()).filter(Boolean);
      expect(declarations, selector).toEqual(['outline: 2px solid rgba(200, 166, 100, 0.7)', 'outline-offset: 2px']);
    }

    // The check-tick SVG: exactly one url-encoded hex, and it is goldInk.
    const encoded = Array.from(stripComments(css, true).matchAll(URLHEX)).map((m) => m[0].slice(3).toUpperCase());
    expect(encoded).toEqual([String(tone.goldInk).replace('#', '').toUpperCase()]);
  });

  it('the serif recipe is declared once, HTitle spreads it and displaySerifStyle owns its optical size', () => {
    const serif = tokens.serifStyle as Record<string, unknown>;
    const display = tokens.displaySerifStyle as Record<string, unknown>;
    expect(serif.fontVariationSettings).toBe("'opsz' 32");
    expect(display.fontVariationSettings).toBe('normal');

    const hTitle = stripComments(exportedFunction(read('components/drive-exotiq/BookingChrome.tsx'), 'HTitle'));
    for (const prop of ['fontFamily', 'fontWeight', 'letterSpacing', 'fontVariationSettings']) {
      expect(hTitle, `HTitle declares ${prop} itself`).not.toContain(prop);
    }
    expect(hTitle).toMatch(/style=\{\s*(?:serifStyle|\{\s*\.\.\.serifStyle\b[^}]*\})\s*\}/);

    // The recipe's letter-spacing is written once on renter surfaces, in tokens.ts.
    const copies: Record<string, number> = {};
    for (const file of scan({ root }).files) {
      const count = Array.from(stripComments(read(file), file.endsWith('.css')).matchAll(/letterSpacing:\s*['"]-0\.014em['"]/g)).length;
      if (count) copies[file] = count;
    }
    expect(copies).toEqual({ 'components/browse/tokens.ts': 1 });
  });
});

// Diff proof against the pre-MP-15 base (SP1): runs only with MP15_BASE_REF set.
describe.skipIf(!BASE_REF)(`MP-15 token sources (${BASE_REF_SKIP_NOTE})`, () => {
  it('the focus-ring rules are byte-identical to the pre-MP-15 globals.css', () => {
    const css = read('app/globals.css');
    const baseCss = showAt(root, mergeBase(root), 'app/globals.css');
    for (const selector of [':-moz-focusring', ':where(*:focus-visible)']) {
      expect(ruleText(css, selector), selector).not.toBe('');
      expect(ruleText(css, selector), selector).toBe(ruleText(baseCss, selector));
    }
  });
});
