// MP-15 legacy theme: delete what nothing references, quarantine the rest in commented LEGACY
// groups (AC13), and leave marketplace-mode typography byte-identical (AC14, driver decision RD5).
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { tone } from '../../components/browse/tokens';
import { compileWith, git, mergeBase, showAt, stripComments } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

// The merge-base theme: 20 colours, 3 families, 2 letter-spacings (spec Appendix C).
const LEGACY_COLORS = [
  'gulf-blue', 'deep-black', 'jet-grey', 'pure-white', 'metallic-silver', 'graphite', 'midnight-blue',
  'exo-bg', 'exo-bg-alt', 'exo-card', 'exo-card-hover', 'exo-teal', 'exo-teal-hover', 'exo-gold',
  'exo-text', 'exo-muted', 'exo-subtle', 'exo-star', 'exo-success', 'exo-error',
];
const LEGACY_FONTS = ['dfaalt', 'mont'];
const LEGACY_TRACKING = ['tight-exotiq', 'wide-exotiq'];
const MUST_BE_GONE = [...LEGACY_COLORS.filter((c) => c.startsWith('exo-')), 'gulf-blue', 'metallic-silver', 'midnight-blue'];
const SANS = ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'];

/** Source the reference counts read: app/, components/ (marketplace included), domain/; comments stripped. */
function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(rel); }
      else if (/\.(tsx?|css)$/.test(entry.name)) out.push({ file: rel, text: stripComments(read(rel), rel.endsWith('.css')) });
    }
  };
  for (const dir of ['app', 'components', 'domain']) walk(dir);
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-token references: `<util>-<key>` for a colour (exo-bg never matches exo-bg-alt), `font-<key>`, `tracking-<key>`. */
function references(kind: 'color' | 'font' | 'tracking', key: string, files: { text: string }[]): number {
  const prefix = kind === 'color' ? '[a-z]+(?:-[trblxy])?' : kind === 'font' ? 'font' : 'tracking';
  const re = new RegExp(`(?<![A-Za-z0-9_])${prefix}-${escape(key)}(?:\\/\\d+)?(?![A-Za-z0-9_-])`, 'g');
  return files.reduce((n, f) => n + Array.from(f.text.matchAll(re)).length, 0);
}

/** `rgb(r g b / alpha)` with the opacity variable resolved from the same rule. */
function resolveColor(decls: string[], prop: string): { channels: string; alpha: string } | null {
  const value = decls.find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1);
  const m = value?.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ (.+))?\)$/);
  if (!m) return null;
  let alpha = m[4] ?? '1';
  const v = alpha.match(/^var\((--[\w-]+)(?:,\s*([\d.]+))?\)$/);
  if (v) alpha = decls.find((d) => d.startsWith(`${v[1]}:`))?.slice(v[1].length + 1) ?? v[2] ?? 'unresolved';
  return { channels: `${m[1]} ${m[2]} ${m[3]}`, alpha };
}

/** The `{isMarketplace && (` ... `)}` head block of app/layout.tsx. */
function marketplaceHead(layout: string): string {
  const start = layout.indexOf('{isMarketplace && (');
  const close = layout.indexOf('</head>', start);
  if (start < 0 || close < 0) return '';
  return layout.slice(start, layout.indexOf(')}', close) + 2);
}

/** Every `@font-face { ... }` block naming Dfaalt, with its offset. */
function dfaaltFaces(css: string): { at: number; text: string }[] {
  return Array.from(css.matchAll(/@font-face\s*\{[^}]*\}/g)).filter((m) => m[0].includes("'Dfaalt'")).map((m) => ({ at: m.index ?? 0, text: m[0] }));
}

describe('MP-15 legacy theme', () => {
  it('legacy names are deleted or quarantined by reference count, mont is kept, and the body and scrollbar colors are unchanged', async () => {
    const theme = config.theme?.extend ?? {};
    const colors = (theme.colors ?? {}) as Record<string, unknown>;
    const fontFamily = (theme.fontFamily ?? {}) as Record<string, unknown>;
    const tracking = (theme.letterSpacing ?? {}) as Record<string, unknown>;
    const files = sources();
    const source = read('tailwind.config.ts');
    const legacyRegions = Array.from(source.matchAll(/\/\*\s*LEGACY:begin[\s\S]*?LEGACY:end\s*\*\//g)).map((m) => m[0]);
    const problems: string[] = [];

    const quarantined = [
      ...Object.keys(colors).filter((key) => !(key in tone)).map((key) => ['color', key] as const),
      ...Object.keys(fontFamily).filter((key) => key !== 'sans').map((key) => ['font', key] as const),
      ...Object.keys(tracking).map((key) => ['tracking', key] as const),
    ];
    for (const [kind, key] of quarantined) {
      const known = kind === 'color' ? LEGACY_COLORS : kind === 'font' ? LEGACY_FONTS : LEGACY_TRACKING;
      if (!known.includes(key)) problems.push(`${kind} ${key}: not a tone key and not a legacy name`);
      const refs = references(kind, key, files);
      if (refs === 0) problems.push(`${kind} ${key}: quarantined with 0 references`);
      if (!legacyRegions.some((region) => region.includes(`"${key}"`) || region.includes(`'${key}'`) || new RegExp(`\\b${escape(key)}\\s*:`).test(region))) {
        problems.push(`${kind} ${key}: kept outside a commented LEGACY group`);
      }
    }
    const removed = [
      ...LEGACY_COLORS.filter((key) => !(key in colors)).map((key) => ['color', key] as const),
      ...LEGACY_FONTS.filter((key) => !(key in fontFamily)).map((key) => ['font', key] as const),
      ...LEGACY_TRACKING.filter((key) => !(key in tracking)).map((key) => ['tracking', key] as const),
    ];
    for (const [kind, key] of removed) {
      const refs = references(kind, key, files);
      if (refs) problems.push(`${kind} ${key}: removed but still referenced ${refs}x`);
    }
    for (const key of MUST_BE_GONE) if (key in colors) problems.push(`color ${key}: still in the theme`);
    if ('dfaalt' in fontFamily) problems.push('fontFamily.dfaalt: still in the theme');
    for (const key of LEGACY_TRACKING) if (key in tracking) problems.push(`letterSpacing.${key}: still in the theme`);
    expect(problems).toEqual([]);

    expect(fontFamily.mont).toEqual(['"Montserrat"', 'sans-serif']);
    expect(fontFamily.sans).toEqual(SANS);

    // The four referenced colours resolve to the same values wherever they now live.
    const { bySelector } = await compileWith(config, [], read('app/globals.css'), path.join(root, 'app/globals.css'));
    expect({
      bodyBackground: resolveColor(bySelector('body'), 'background-color'),
      bodyText: resolveColor(bySelector('body'), 'color'),
      scrollbarTrack: resolveColor(bySelector('::-webkit-scrollbar-track'), 'background-color'),
      scrollbarThumb: resolveColor(bySelector('::-webkit-scrollbar-thumb'), 'background-color'),
    }).toEqual({
      bodyBackground: { channels: '0 0 0', alpha: '1' },
      bodyText: { channels: '255 255 255', alpha: '1' },
      scrollbarTrack: { channels: '27 27 27', alpha: '1' },
      scrollbarThumb: { channels: '58 58 58', alpha: '1' },
    });
  });

  it('the gated Montserrat head, the mont family and the Dfaalt font-face are byte-identical', async () => {
    const base = mergeBase(root);
    const problems: string[] = [];

    // app/layout.tsx: the marketplace-gated head is byte-identical; the only hunks are the tone import and themeColor.
    const layout = read('app/layout.tsx');
    const head = marketplaceHead(layout);
    if (!head.includes('rel="preconnect" href="https://fonts.gstatic.com"') || !head.includes('family=Montserrat')) problems.push('layout.tsx: Montserrat preconnect/link missing');
    if (head !== marketplaceHead(showAt(root, base, 'app/layout.tsx'))) problems.push('layout.tsx: the {isMarketplace && <head>} block differs from the merge-base');
    const hunks = git(root, ['diff', '-U0', base, '--', 'app/layout.tsx']).split('\n')
      .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line));
    for (const line of hunks) {
      const ok = /^[+-]\s*themeColor: isMarketplace \? "#0B0B0F" : /.test(line) || /^\+import \{ tone \} from "@\/components\/browse\/tokens";$/.test(line);
      if (!ok) problems.push(`layout.tsx: unexpected change ${line}`);
    }

    // app/globals.css: the three Dfaalt faces, byte-identical, each inside a legacy-marketplace fence.
    const css = read('app/globals.css');
    const faces = dfaaltFaces(css);
    const baseFaces = dfaaltFaces(showAt(root, base, 'app/globals.css'));
    if (faces.length !== 3) problems.push(`globals.css: ${faces.length} Dfaalt @font-face blocks, expected 3`);
    if (JSON.stringify(faces.map((f) => f.text)) !== JSON.stringify(baseFaces.map((f) => f.text))) problems.push('globals.css: a Dfaalt @font-face differs from the merge-base');
    for (const face of faces) {
      const before = css.slice(0, face.at);
      const lastBegin = before.lastIndexOf('/* legacy-marketplace:begin */');
      if (lastBegin < 0 || before.lastIndexOf('/* legacy-marketplace:end */') > lastBegin) problems.push(`globals.css: Dfaalt face at ${face.at} is outside a legacy-marketplace fence`);
    }

    // public/fonts/dfaalt/* untouched (git diff exits non-zero on a difference and throws).
    try { git(root, ['diff', '--quiet', base, '--', 'public/fonts/dfaalt']); } catch { problems.push('public/fonts/dfaalt: changed'); }
    expect(problems).toEqual([]);

    // fontFamily.mont compiles to the Montserrat stack.
    const { css: mont } = await compileWith(config, ['font-mont']);
    expect(mont).toMatch(/\.font-mont \{\s*font-family: "Montserrat", sans-serif;?\s*\}/);
  });
});
