// MP-15 type: one 11-step scale with paired line-heights (AC7), nothing off it on a renter
// surface (AC8), and every iOS-focusable input at 16px without breaking pinch-zoom (AC10).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { SIZE_EXEMPT_DIRS, scan, stripComments } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// D5 / AC7, in emission order: a later (larger) step wins a className-order tie (R9).
const STEPS: [string, string, string][] = [
  ['micro', '10px', '1.4'], ['label', '11px', '1.45'], ['body-sm', '13px', '1.5'], ['body', '15px', '1.5'],
  ['body-lg', '16px', '1.5'], ['title-sm', '18px', '1.4'], ['title', '22px', '1.35'], ['heading', '28px', '1.3'],
  ['display', '36px', '1.2'], ['display-lg', '48px', '1.1'], ['display-xl', '56px', '1.05'],
];
const STEP_NAMES = STEPS.map(([name]) => name);

// R7 one-offs: a bracket size that stays needs an entry here AND an adjacent `type-exception:`
// comment at the site. Starts (and should stay) empty.
const TYPE_EXCEPTIONS: { file: string; token: string; why: string }[] = [];

// `text-<name>` utilities that are not font sizes.
const TEXT_NOT_SIZE = new Set(['left', 'center', 'right', 'justify', 'start', 'end', 'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip', 'transparent', 'current', 'inherit', 'white', 'black']);

/** Every font-size class in a class string (any variant): a step, a bracket size or a default size. */
function sizeClasses(classString: string): string[] {
  const size = /(?:^|:)text-(micro|label|body-sm|body-lg|body|title-sm|title|heading|display-xl|display-lg|display|\[[0-9.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)$/;
  return classString.split(/\s+/).filter((cls) => size.test(cls));
}

/** The first `className="..."` after an anchor in a source file. */
function classNameAfter(source: string, anchor: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) throw new Error(`anchor not found: ${anchor}`);
  const start = source.indexOf('className="', at);
  if (start < 0) throw new Error(`no className after ${anchor}`);
  return source.slice(start + 'className="'.length, source.indexOf('"', start + 'className="'.length));
}

describe('MP-15 type scale', () => {
  it('the type scale is the 11 contract steps with paired line-heights', () => {
    const fontSize = (config.theme?.extend?.fontSize ?? {}) as Record<string, unknown>;
    expect(Object.keys(fontSize)).toEqual(STEP_NAMES);
    expect(fontSize).toEqual(Object.fromEntries(STEPS.map(([name, px, lineHeight]) => [name, [px, { lineHeight }]])));
    expect(sizeClasses(tokens.eyebrowClassName)).toEqual(['text-label']);
    expect(sizeClasses(tokens.microLabelClassName)).toEqual(['text-micro']);
  });

  it('no off-scale font size remains on a renter surface', () => {
    const report = scan({ root });
    const listed = (site: { file: string; token: string }) => TYPE_EXCEPTIONS.some((e) => e.file === site.file && e.token === site.token);
    expect(report.sizeSites.filter((site) => !listed(site)).map((site) => `${site.file}: ${site.token}`)).toEqual([]);

    // An allowlisted one-off still needs its `type-exception:` comment on the line or the two above.
    const uncommented = report.sizeSites.filter(listed).filter((site) => {
      const lines = read(site.file).split('\n');
      return !lines.slice(Math.max(0, site.line - 3), site.line).some((line) => line.includes('type-exception:'));
    });
    expect(uncommented.map((site) => `${site.file}:${site.line}: ${site.token}`)).toEqual([]);

    // The analytics zone keeps its 10 literals byte-for-byte (D10); an 11th there is not exempt.
    expect(report.sizeExempt).toBe(10);

    // Every named text-<size> in use outside that zone is one of the 11 steps.
    const colorNames = new Set([...Object.keys(tokens.tone), 'deep-black', 'pure-white', 'jet-grey', 'graphite']);
    const unknown: string[] = [];
    for (const file of report.files) {
      if (SIZE_EXEMPT_DIRS.some((dir: string) => file.startsWith(dir))) continue;
      const text = stripComments(read(file), file.endsWith('.css'));
      for (const m of Array.from(text.matchAll(/(?<![A-Za-z0-9_-])text-([a-zA-Z][A-Za-z0-9-]*)(?:\/\d+)?(?![A-Za-z0-9_[-])/g))) {
        const name = m[1];
        if (STEP_NAMES.includes(name) || colorNames.has(name) || TEXT_NOT_SIZE.has(name)) continue;
        unknown.push(`${file}: text-${name}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('every iOS-focusable input recipe is 16px and the viewport still allows zoom', () => {
    const driver = read('components/drive-exotiq/flow/DriverStep.tsx').match(/const fieldClass = '([^']*)'/);
    const recipes: Record<string, string> = {
      fieldClassName: tokens.fieldClassName,
      selectClassName: tokens.selectClassName,
      datePillClassName: tokens.datePillClassName,
      'DriverStep fieldClass': driver ? driver[1] : '(not found)',
      'DatesStep pickup-time <select>': classNameAfter(read('components/drive-exotiq/flow/DatesStep.tsx'), '<select'),
      'EmailCaptureForm e-mail <input>': classNameAfter(read('components/renters/EmailCaptureForm.tsx'), 'type="email"'),
    };
    const wrong = Object.entries(recipes)
      .filter(([, classes]) => JSON.stringify(sizeClasses(classes)) !== JSON.stringify(['text-body-lg']))
      .map(([name, classes]) => `${name}: ${sizeClasses(classes).join(' ') || '(no size class)'}`);
    expect(wrong).toEqual([]);

    // R10: pinch-zoom stays; the fix is 16px text, not a locked viewport.
    expect(stripComments(read('app/layout.tsx'))).not.toMatch(/maximum-scale|maximumScale|user-scalable|userScalable/);
  });
});
