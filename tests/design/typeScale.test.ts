// MP-15 type: one 11-step scale with paired line-heights (AC7), nothing off it on a renter
// surface (AC8), and every iOS-focusable input at 16px without breaking pinch-zoom (AC10).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { SIZE_EXEMPT_DIRS, compileWith, scan, stripComments } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// D5 / AC7, in the contract's order (the config keeps it). This is not the CSS order: Tailwind 3.4.19
// emits one plugin's utilities sorted by class name, so when two steps meet on one element the
// alphabetically later one wins, whatever their size or className order (spec R9's prose is wrong;
// kb/tickets/MP-15.md holds the correction). Pair two steps through a breakpoint variant (max-lg:/lg:),
// emitted after base utilities; the HTitle test below pins it.
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

/** Does a media query's params hold at this viewport width? (min-width, Tailwind's max-* form, max-width.) */
function mediaMatches(params: string, width: number): boolean {
  const notMin = /^not all and \(min-width:\s*(\d+)px\)$/.exec(params);
  if (notMin) return width < Number(notMin[1]);
  const min = /^\(min-width:\s*(\d+)px\)$/.exec(params);
  if (min) return width >= Number(min[1]);
  const max = /^\(max-width:\s*(\d+)px\)$/.exec(params);
  if (max) return width <= Number(max[1]);
  return false;
}

/**
 * The font-size class that wins on ONE element carrying `classes`, as the browser resolves it:
 * Tailwind compiles them with the real config, equal-specificity rules cascade in emitted order,
 * and media rules apply only when they match `width`. (Tailwind 3.4 emits one plugin's
 * utilities sorted by name, not by scale step or by className order.)
 */
async function winningSize(classes: string[], width: number): Promise<string | undefined> {
  const { rules } = await compileWith(config, classes);
  let winner: string | undefined;
  for (const r of rules) {
    if (!r.decls.some((d: string) => d.startsWith('font-size:'))) continue;
    let applies = true;
    for (let p = r.rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && p.name === 'media') applies = applies && mediaMatches(p.params, width);
    const cls = r.selector.replace(/\\(.)/g, '$1').replace(/^\./, '');
    if (applies && classes.includes(cls)) winner = cls;
  }
  return winner?.slice(winner.lastIndexOf(':') + 1);
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

  // R9 at the source level: AC9 only sees that a computed size is ON the scale, so a caller whose step
  // silently loses to HTitle's own (both on the scale) passes it. This pins the caller's intent.
  it('every HTitle caller renders the step it passes, under Tailwind\'s real emission order', async () => {
    const chrome = read('components/drive-exotiq/BookingChrome.tsx');
    const base = chrome.slice(chrome.indexOf('export function HTitle')).match(/className=\{`([^`$]*)\$\{className\}`\}/);
    expect(base, 'HTitle base className not found').not.toBeNull();
    const baseClasses = (base?.[1] ?? '').split(/\s+/).filter(Boolean);
    const callers: { at: string; classes: string[] }[] = [];
    for (const file of scan({ root }).files.filter((f: string) => f.endsWith('.tsx'))) {
      for (const m of Array.from(read(file).matchAll(/<HTitle(?:\s+className="([^"]*)")?\s*>/g))) {
        callers.push({ at: `${file}: ${m[0]}`, classes: (m[1] ?? '').split(/\s+/).filter(Boolean) });
      }
    }
    expect(callers.length).toBeGreaterThanOrEqual(8);
    const wrong: string[] = [];
    for (const caller of callers) {
      for (const width of [390, 1280]) {
        const asked = (await winningSize(caller.classes, width)) ?? (await winningSize(baseClasses, width));
        const got = await winningSize([...baseClasses, ...caller.classes], width);
        if (got !== asked) wrong.push(`${caller.at} @${width}: asks ${asked}, renders ${got}`);
      }
    }
    expect(wrong).toEqual([]);
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
