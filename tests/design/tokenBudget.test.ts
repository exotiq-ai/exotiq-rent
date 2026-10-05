// MP-15 grep budget: no tone colour is retyped as a literal on a renter surface (AC4),
// inline styles read `tone` (AC5), and the rgba() restatements only ratchet down (AC6).
// Tests live outside Tailwind's content globs (spec P4), so fixture strings here never
// reach the CSS bundle.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tone } from '../../components/browse/tokens';
import { HEX, HEX_EXCEPTIONS, RGBA_BASELINE_FILES, RGBA_CEILING, scan, stripComments } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const toneHex = Object.values(tone).map((v) => v.replace(/^#/, '').toUpperCase());

/** The source text of one exported function, up to the next top-level export. */
function exportedFunction(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  if (start < 0) throw new Error(`export function ${name} not found`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

describe('MP-15 grep budget', () => {
  it('no tone color is written as a literal on a renter surface', () => {
    const report = scan({ root, toneHex });
    // Names every offender as `file: #hex`.
    expect(report.hexViolations).toEqual([]);

    // Exactly two sanctioned exceptions: exact file + exact value, each with its reason.
    expect(HEX_EXCEPTIONS.map(({ file, values }) => ({ file, values }))).toEqual([
      { file: 'components/analytics/CookieControls.tsx', values: ['465064', '252B38', 'CDD1D9', '353B49', '0008'] },
      { file: 'app/layout.tsx', values: ['0B0B0F'] },
    ]);
    for (const exception of HEX_EXCEPTIONS) expect(exception.why.length, exception.file).toBeGreaterThan(20);
    expect(report.hexAllowed).toBe(6);

    // The HTML e-mail keeps literal hex (P5) but may only use values that exist in tone.
    const email = stripComments(read('domain/renters/email.ts'));
    const outside = Array.from(email.matchAll(HEX)).map((m) => m[0]).filter((h) => !toneHex.includes(h.slice(1).toUpperCase()));
    expect(outside).toEqual([]);
  });

  it('inline styles, the OG image and the theme color read tone', () => {
    const problems: string[] = [];

    const chrome = read('components/drive-exotiq/BookingChrome.tsx');
    const primary = stripComments(exportedFunction(chrome, 'PrimaryButton'));
    if (Array.from(primary.matchAll(HEX)).length) problems.push('BookingChrome PrimaryButton: string hex in its style');
    if (!/backgroundColor:\s*tone\.gold\b/.test(primary)) problems.push('BookingChrome PrimaryButton: backgroundColor is not tone.gold');
    if (!/color:\s*tone\.goldInk\b/.test(primary)) problems.push('BookingChrome PrimaryButton: color is not tone.goldInk');

    const og = stripComments(read('app/share/[operatorSlug]/[vehicleSlug]/opengraph-image.tsx'));
    const ogHex = Array.from(og.matchAll(HEX)).map((m) => m[0]);
    if (ogHex.length) problems.push(`opengraph-image.tsx: string hex ${ogHex.join(' ')}`);
    if (!/import \{ tone \} from ['"]@\/components\/browse\/tokens['"]/.test(og)) problems.push('opengraph-image.tsx: no tone import');

    const layout = stripComments(read('app/layout.tsx'));
    if (!/themeColor:\s*isMarketplace\s*\?\s*"#0B0B0F"\s*:\s*tone\.ground\s*,/.test(layout)) problems.push('layout.tsx: themeColor booking branch is not tone.ground');

    const booking = read('components/marketplace/BookingPage.tsx');
    if (!/import \{ tone \} from ['"]@\/components\/browse\/tokens['"]/.test(booking)) problems.push('marketplace/BookingPage.tsx: no tone import');
    if (!/'#6EC1E4' : tone\.gold,/.test(booking)) problems.push('marketplace/BookingPage.tsx: the exo-gold badge does not read tone.gold');
    if (/#C9A84C/i.test(booking)) problems.push("marketplace/BookingPage.tsx: '#C9A84C' still present");

    expect(problems).toEqual([]);
  });

  it('rgba restatements of tone colors do not grow past the baseline of 25', () => {
    const report = scan({ root, toneHex });
    expect(report.rgba).toBeLessThanOrEqual(RGBA_CEILING);
    expect(Object.keys(report.rgbaByFile).filter((file) => !RGBA_BASELINE_FILES.includes(file))).toEqual([]);
  });

  describe('stripComments (the scan reads source the way the budget does)', () => {
    it('keeps a URL: https:// is not a line comment', () => {
      expect(stripComments("const u = 'https://x.example/#a1b2c3';")).toContain('https://x.example/#a1b2c3');
    });
    it('strips JSX {/* */} comments and block comments, keeping line numbers', () => {
      const out = stripComments('<div>{/* bg-[#C8A664] */}</div>\n/* #2A2E3A\n */ x');
      expect(out).not.toMatch(/#C8A664|#2A2E3A/);
      expect(out.split('\n')).toHaveLength(3);
    });
    it('still counts a hex inside a template string', () => {
      const out = stripComments('const s = `linear-gradient(90deg, #0B0D12 0%, transparent)`;');
      expect(Array.from(out.matchAll(HEX)).map((m) => m[0])).toEqual(['#0B0D12']);
    });
    it('ignores a hex in a // line comment', () => {
      const out = stripComments("const a = 1; // was text-[#9BA1B0]\nconst b = 2;");
      expect(Array.from(out.matchAll(HEX))).toHaveLength(0);
    });
  });
});
