// MP-15 runtime proof. Reads the evidence the Appendix B capture writes under
// MP15_EVIDENCE_DIR (= <shop>/.autodev/evidence/MP-15); without it these six tests skip.
// AC9, AC11, AC16, AC17, AC18 (d), AC19.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = process.env.MP15_EVIDENCE_DIR ?? '';
const SCALE = ['10px', '11px', '13px', '15px', '16px', '18px', '22px', '28px', '36px', '48px', '56px'];
const VIEWS = ['storefront', 'vehicle', 'flow-dates', 'flow-driver', 'flow-review', 'flow-pay', 'confirmation', 'browse', 'saved', 'privacy'];
const WIDTHS = [390, 1280];
const NARROW = ['browse', 'storefront', 'flow-driver']; // also captured at 360x740 for overflow
// AC18 (d) minimum: vehicle and flow at mobile, /privacy at desktop (every captured pair is compared).
const COOKIE_REQUIRED = ['cookie-vehicle@390.json', 'cookie-flow-dates@390.json', 'cookie-privacy@1280.json'];

type Histogram = Record<string, number>;
interface Capture {
  nodes: number; colors: Histogram; fontSizes: Histogram; lineHeights: Histogram; textHash: string;
  inputs: { tag: string; type: string; name: string; fontSize: number; clipped: boolean }[];
  overflow: { scrollWidth: number; innerWidth: number };
  headFonts: string[]; fontFamilies: Histogram; faces: string[];
}
interface CookieSubtree { colors: Histogram; fontSizes: Histogram; lineHeights: Histogram; targets: number[][] }

const file = (...p: string[]) => path.join(DIR, ...p);
function load<T>(...p: string[]): T {
  const f = file(...p);
  if (!existsSync(f)) throw new Error(`missing evidence: ${path.relative(DIR, f)}`);
  return JSON.parse(readFileSync(f, 'utf8')) as T;
}
const views = () => VIEWS.flatMap((v) => WIDTHS.map((w) => `${v}@${w}`));

/** Route -> First Load JS (kB) and the shared total, from a `next build` log. */
function bundle(log: string): { shared: number; routes: Record<string, number> } {
  const kb = (n: string, unit: string) => (unit === 'B' ? Number(n) / 1000 : Number(n));
  const routes: Record<string, number> = {};
  for (const m of Array.from(log.matchAll(/^[┌├└]\s+[○ƒλ●]\s+(\S+)\s+[\d.]+\s+k?B\s+([\d.]+)\s+(k?B)\s*$/gm))) routes[m[1]] = kb(m[2], m[3] === 'kB' ? 'kB' : 'B');
  const shared = log.match(/First Load JS shared by all\s+([\d.]+)\s+kB/);
  return { shared: shared ? Number(shared[1]) : NaN, routes };
}

describe.skipIf(!DIR)('MP-15 visual proof (evidence in MP15_EVIDENCE_DIR)', () => {
  it('computed font sizes on every sampled view sit on the scale', () => {
    const problems: string[] = [];
    for (const tag of views()) {
      const after = load<Capture>('after', `${tag}.json`);
      const sizes = Object.keys(after.fontSizes);
      const off = sizes.filter((s) => !SCALE.includes(s));
      if (off.length) problems.push(`${tag}: off-scale ${off.join(' ')}`);
      if (sizes.length > 11) problems.push(`${tag}: ${sizes.length} distinct sizes`);
    }
    expect(problems).toEqual([]);
  });

  it('every iOS-focusable input computes to at least 16px and nothing overflows at 360px', () => {
    const problems: string[] = [];
    const tags = [...views(), ...NARROW.map((v) => `${v}@360`)];
    for (const tag of tags) {
      const after = load<Capture>('after', `${tag}.json`);
      for (const input of after.inputs) if (input.fontSize < 16) problems.push(`${tag}: ${input.tag}[${input.type}] ${input.name} at ${input.fontSize}px`);
      if (tag.endsWith('@360') && after.overflow.scrollWidth > after.overflow.innerWidth) problems.push(`${tag}: scrollWidth ${after.overflow.scrollWidth} > ${after.overflow.innerWidth}`);
    }
    if (!existsSync(file('screenshots', 'after', 'browse@360.png'))) problems.push('missing screenshots/after/browse@360.png');
    expect(problems).toEqual([]);
  });

  it('after matches before: colors, node counts, copy, og image and screenshots', () => {
    const problems: string[] = [];
    for (const tag of views()) {
      const before = load<Capture>('before', `${tag}.json`);
      const after = load<Capture>('after', `${tag}.json`);
      if (JSON.stringify(after.colors) !== JSON.stringify(before.colors)) {
        const keys = Array.from(new Set([...Object.keys(before.colors), ...Object.keys(after.colors)])).filter((k) => before.colors[k] !== after.colors[k]);
        problems.push(`${tag}: colours differ ${keys.map((k) => `${k} ${before.colors[k] ?? 0}->${after.colors[k] ?? 0}`).join(', ')}`);
      }
      if (after.nodes !== before.nodes) problems.push(`${tag}: nodes ${before.nodes} -> ${after.nodes}`);
      if (after.textHash !== before.textHash) problems.push(`${tag}: visible text changed`);
      for (const phase of ['before', 'after']) if (!existsSync(file('screenshots', phase, `${tag}.png`))) problems.push(`missing screenshots/${phase}/${tag}.png`);
    }
    const og = load<{ status: number; contentType: string; width: number; height: number }>('og.json');
    expect(og).toEqual({ status: 200, contentType: 'image/png', width: 1200, height: 630 });
    expect(problems).toEqual([]);
  });

  it('build log is clean and the bundle did not grow', () => {
    const read = (name: string) => { if (!existsSync(file(name))) throw new Error(`missing evidence: ${name}`); return readFileSync(file(name), 'utf8'); };
    const after = read('build.log'), before = read('build-baseline.log');
    expect(after).toMatch(/^exit=0$/m);
    expect(after).not.toMatch(/Failed to compile|Type error/);
    const a = bundle(after), b = bundle(before);
    expect(Object.keys(a.routes).length).toBeGreaterThan(10);
    expect(a.shared).toBeLessThanOrEqual(b.shared + 0.5);
    const grown = Object.entries(a.routes).filter(([route, kb]) => kb > (b.routes[route] ?? Infinity) + 1.0).map(([route, kb]) => `${route} ${b.routes[route]} -> ${kb}`);
    expect(grown).toEqual([]);

    // The pre-existing marketplace-gated Montserrat warning: once, in app/layout.tsx, same message.
    const warning = (log: string) => Array.from(log.matchAll(/^\.\/(\S+)\n(?:\d+:\d+ .*\n)*?\d+:\d+\s+(Warning: .*no-page-custom-font)$/gm)).map((m) => `${m[1]} ${m[2]}`);
    expect(warning(after)).toEqual(warning(before));
    expect(warning(after)).toHaveLength(1);
    expect(warning(after)[0]).toMatch(/^app\/layout\.tsx /);
    const otherWarnings = (log: string) => Array.from(log.matchAll(/Warning: .*@next\/next\/([\w-]+)/g)).map((m) => m[1]).filter((rule) => rule !== 'no-img-element' && rule !== 'no-page-custom-font');
    expect(otherWarnings(after)).toEqual([]);

    const vitest = read('vitest.log');
    const tests = vitest.match(/Tests\s+(\d+) passed \((\d+)\)/);
    expect(tests, 'vitest.log has no all-passed summary').not.toBeNull();
    expect(Number(tests?.[1])).toBeGreaterThanOrEqual(231);
    expect(vitest).not.toMatch(/\d+ failed/);
  });

  it('the cookie-controls subtree is identical before and after', () => {
    const problems: string[] = [];
    const captured = readdirSync(file('before')).filter((f) => f.startsWith('cookie-'));
    for (const name of COOKIE_REQUIRED) if (!captured.includes(name)) problems.push(`missing before/${name}`);
    const pick = (s: CookieSubtree | null) => s && { colors: s.colors, fontSizes: s.fontSizes, lineHeights: s.lineHeights, targets: s.targets };
    for (const name of captured) {
      const before = load<{ closed: CookieSubtree[]; open: (CookieSubtree | null)[] }>('before', name);
      const after = load<{ closed: CookieSubtree[]; open: (CookieSubtree | null)[] }>('after', name);
      for (const state of ['closed', 'open'] as const) {
        if (JSON.stringify(before[state].map(pick)) !== JSON.stringify(after[state].map(pick))) problems.push(`${name} (${state}) differs`);
      }
      if (!before.open.some(Boolean)) problems.push(`${name}: the dialog was never opened`);
    }
    expect(problems).toEqual([]);
  });

  it('marketplace mode typography is untouched', () => {
    const before = load<Capture>('marketplace', 'before.json');
    const after = load<Capture>('marketplace', 'after.json');
    expect(after.headFonts).toEqual(before.headFonts);
    expect(before.headFonts.some((l) => l.includes('family=Montserrat'))).toBe(true);
    expect(after.fontFamilies).toEqual(before.fontFamilies);
    expect(after.fontSizes).toEqual(before.fontSizes);
    const faces = (c: Capture) => c.faces.filter((f) => /^(Montserrat|Dfaalt) /.test(f));
    expect(faces(after)).toEqual(faces(before));

    // Colours identical, except the exo-gold badge text (RD10): #C9A84C -> tone.gold #C8A664.
    const OLD = 'color|rgb(201, 168, 76)', NEW = 'color|rgb(200, 166, 100)';
    const keys = Array.from(new Set([...Object.keys(before.colors), ...Object.keys(after.colors)])).filter((k) => before.colors[k] !== after.colors[k]);
    const moved = (before.colors[OLD] ?? 0) - (after.colors[OLD] ?? 0);
    const allowed = keys.every((k) => k === OLD || k === NEW) && (after.colors[NEW] ?? 0) - (before.colors[NEW] ?? 0) === moved;
    expect(allowed, `marketplace colours differ: ${keys.join(', ')}`).toBe(true);

    // Booking mode still loads no Montserrat on any sampled view.
    const leaked = views().filter((tag) => load<Capture>('after', `${tag}.json`).headFonts.some((l) => l.includes('Montserrat')));
    expect(leaked).toEqual([]);
  });
});
