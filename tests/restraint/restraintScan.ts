// MP-16 restraint scanner (spec "Scanner definitions"; plan T0). Not a test file: the six
// restraint.*.test.ts files import it. It lives under tests/, outside Tailwind's content globs
// and MP-15's budget scan, so its gold pattern and fixtures never reach the CSS bundle (LD1).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tone } from '../../components/browse/tokens';
import { cut, stripComments } from '../design/lib/scan.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

/** The renter tree: sorted repo-relative .ts/.tsx/.css paths; tests, marketplace, analytics and app/api skipped. */
export function renterFiles(): string[] {
  const out: string[] = [];
  const skip = ['components/marketplace', 'components/analytics', 'app/api'];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.next' && !skip.includes(rel)) walk(rel);
      } else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
    }
  };
  for (const d of ['components/drive-exotiq', 'components/browse', 'components/renters', 'app']) walk(d);
  return out.sort();
}

/** Comments out; in CSS the tone-mirror fence is cut first (LD2: the mirror defines, it does not use). */
export function prepare(rel: string, raw: string): string {
  const css = rel.endsWith('.css');
  return stripComments(css ? cut(raw, '/* tone-mirror:begin */', '/* tone-mirror:end */') : raw, css);
}

const hex = tone.gold.slice(1);
const [gr, gg, gb] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A gold reference (AC1): a gold utility not followed by a letter or digit, tone.gold, a CSS-var use of the gold mirror, the hex, the rgba. */
export const GOLD_RE = new RegExp(
  [
    `[a-z\\]]-gold(?![A-Za-z0-9])`,
    `tone\\.gold(?![A-Za-z])`,
    `var\\(--[a-z-]*gold(?![a-z-])`,
    `#${hex}`,
    `rgba\\(\\s*${gr}\\s*,\\s*${gg}\\s*,\\s*${gb}`,
  ].join('|'),
  'gi',
);
export const goldCount = (text: string): number => (text.match(GOLD_RE) ?? []).length;

/** Gold references per renter file (comments stripped, mirror fence skipped); files with none are omitted. */
export function goldByFile(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of renterFiles()) {
    const n = goldCount(prepare(rel, read(rel)));
    if (n) out[rel] = n;
  }
  return out;
}

/** Every quoted or template literal (a template runs to its closing backtick, nested ternary quotes included). */
export const literals = (text: string): string[] =>
  Array.from(text.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g), (m) => m[1] ?? m[2] ?? m[3] ?? '');

/** A box: rounded-lg|xl|2xl + a bare border + a surface fill, not a pill and not a fixed-size control. */
export const isBox = (s: string): boolean =>
  /\brounded-(lg|xl|2xl)\b/.test(s) &&
  /(^|\s)border(\s|$)/.test(s) &&
  /(^|[\s:'"])bg-(surface2?|panel|goldWash)(?![A-Za-z0-9-])/.test(s) &&
  !/rounded-full/.test(s) &&
  !/(^|\s)[hw]-\d/.test(s);

/** LD6: .tsx only; the tokens.ts recipes (the card shell) are not in the census. */
export function boxesByFile(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of renterFiles()) {
    if (!rel.endsWith('.tsx')) continue;
    const n = literals(prepare(rel, read(rel))).filter(isBox).length;
    if (n) out[rel] = n;
  }
  return out;
}

/** The stat-tile recipe across the renter tree (6 at base, 0 after). */
export const STAT_TILE = 'rounded-lg bg-surface2 p-3';
export const statTileCount = (): number =>
  renterFiles()
    .filter((r) => r.endsWith('.tsx'))
    .reduce((n, r) => n + literals(prepare(r, read(r))).filter((s) => s.includes(STAT_TILE)).length, 0);

/** From `function Name` to the next top-level function/export/type/Capitalised const. */
export function sliceFunction(src: string, name: string): string {
  const m = new RegExp(`(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function ${name}\\b`).exec(src);
  if (!m) throw new Error(`function ${name} not found`);
  const from = m.index + m[0].length;
  const next = src.slice(from).search(/\n(?:export\s|function\s|async function\s|type\s|const\s[A-Z])/);
  return src.slice(m.index, next < 0 ? undefined : from + next);
}

/** `radius` characters of source around the first occurrence of `needle`. */
export const around = (src: string, needle: string, radius = 320): string => {
  const at = src.indexOf(needle);
  if (at < 0) throw new Error(`anchor not found: ${needle}`);
  return src.slice(Math.max(0, at - radius), at + needle.length + radius);
};

/** Source from the first `from` anchor up to (not including) the next `to` anchor. */
export const between = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from);
  if (a < 0) throw new Error(`anchor not found: ${from}`);
  const b = src.indexOf(to, a + from.length);
  if (b < 0) throw new Error(`anchor not found after ${from}: ${to}`);
  return src.slice(a, b);
};

/** Every JSX opening tag `<Tag …>` / `<Tag … />` in `src` (braces skipped, so an arrow inside a prop never ends the tag). */
export function openTags(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag.replace(/\./g, '\\.')}(?=[\\s/>])`, 'g');
  for (const m of Array.from(src.matchAll(re))) {
    let depth = 0;
    let i = m.index ?? 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

/** The className expression of one opening tag ('' when it has none). */
export function classOf(tagText: string): string {
  const m = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{([^}]*)\})/.exec(tagText);
  return m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '') : '';
}

/** Utilities whose variant chain includes hover:, active: or group-hover: and that name gold (AC3). */
export const hoverGoldTokens = (text: string): string[] =>
  text.split(/[\s'"`{}]+/).filter((t) => /(^|:)(group-)?(hover|active):/.test(t) && goldCount(t) > 0);

/** Each needle missing from `text`, labelled. */
export const missing = (label: string, text: string, ...needles: string[]): string[] =>
  needles.filter((n) => !text.includes(n)).map((n) => `${label}: missing ${n}`);

/** Each needle present in `text`, labelled. */
export const present = (label: string, text: string, ...needles: string[]): string[] =>
  needles.filter((n) => text.includes(n)).map((n) => `${label}: still has ${n}`);

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};

/** WCAG 2.x contrast ratio of two #RRGGBB colours. */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** `fg` at `alpha` composited over `bg`, as #rrggbb. */
export function mix(fg: string, bg: string, alpha: number): string {
  const f = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const ch = (s: number) => Math.round(((f >> s) & 255) * alpha + ((b >> s) & 255) * (1 - alpha));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** HSL hue in degrees. */
export function hue(h: string): number {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  return ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
}

/** Euclidean RGB distance. */
export function rgbDistance(a: string, b: string): number {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  return Math.hypot(((x >> 16) & 255) - ((y >> 16) & 255), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
}
