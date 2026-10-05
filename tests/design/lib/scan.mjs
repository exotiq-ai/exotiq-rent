// MP-15 grep-budget scan (spec Appendix A, the reference implementation, made importable).
// Run from the exotiq-rent repo root:
//   node tests/design/lib/scan.mjs            -> report
//   node tests/design/lib/scan.mjs --check    -> same report, exit 1 when the budget is violated
//   node tests/design/lib/scan.mjs --list     -> also list every violation (file:line: value)
//   node tests/design/lib/scan.mjs --root <dir> --ac1
//        --root scans another checkout; --ac1 uses the 19 AC1 tone values instead of parsing
//        <root>/components/browse/tokens.ts (a baseline checkout's tone has only 10 keys).
// The vitest tests in tests/design/ import scan() and read the real tone values.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// Every tone value (14 contract colours + 5 residual tokens), uppercase, no '#'.
export const AC1_TONE_HEX = ['06070A', '0D0F14', '161922', '1E2230', '10131A', '2A2E3A', '3A3F4D', 'F0F2F5', '9BA1B0', '848A9A', 'C8A664', '1A1308', '6EC1E4', 'FFB84D', '14130F', '0B0D12', '3D4250', '5C6272', 'D7DAE0'];

// Sanctioned exceptions: exact file + exact value, each with a reason. Nothing else passes.
export const HEX_EXCEPTIONS = [
  { file: 'components/analytics/CookieControls.tsx', values: ['465064', '252B38', 'CDD1D9', '353B49', '0008'], why: 'compliance-bearing analytics zone: its own toggle/dialog palette, not restyled by the restraint pass' },
  { file: 'app/layout.tsx', values: ['0B0B0F'], why: 'marketplace-mode themeColor = the mockup ground; retired with the mockup (T-2)' },
];

// Type literals are not migrated inside the analytics zone (driver addendum 2026-10-05).
export const SIZE_EXEMPT_DIRS = ['components/analytics/'];

// Files whose rgba() tone restatements existed at the merge-base (AC6: none may appear elsewhere).
export const RGBA_BASELINE_FILES = [
  'app/[operatorSlug]/page.tsx',
  'app/globals.css',
  'app/preview/page.tsx',
  'app/share/[operatorSlug]/[vehicleSlug]/opengraph-image.tsx',
  'app/share/[operatorSlug]/[vehicleSlug]/page.tsx',
  'components/browse/tokens.ts',
  'components/drive-exotiq/BookingChrome.tsx',
  'components/drive-exotiq/IdentityVerificationCard.tsx',
  'components/drive-exotiq/PaymentCard.tsx',
  'components/drive-exotiq/VehicleEntryPage.tsx',
  'components/drive-exotiq/VehicleGallery.tsx',
  'components/drive-exotiq/flow/DatesStep.tsx',
  'components/drive-exotiq/flow/PayStep.tsx',
  'components/drive-exotiq/flow/shared.tsx',
];
export const RGBA_CEILING = 25;

const keepNewlines = (s) => s.replace(/[^\n]/g, '');

/**
 * Strip comments the way the budget reads source: block comments (incl. JSX `{/* *\/}`)
 * and, outside CSS, `//` line comments that do not follow a `:` (so `https://x` survives).
 * Newlines are preserved so line numbers still point at the source.
 * @param {string} text
 * @param {boolean} [isCss]
 */
export function stripComments(text, isCss = false) {
  let t = text.replace(/\/\*[\s\S]*?\*\//g, keepNewlines);
  if (!isCss) t = t.replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  return t;
}

/** @param {string} text @param {string} begin @param {string} end */
export function cut(text, begin, end) {
  let out = text;
  for (;;) {
    const b = out.indexOf(begin);
    if (b < 0) return out;
    const e = out.indexOf(end, b);
    if (e < 0) return out.slice(0, b);
    out = out.slice(0, b) + keepNewlines(out.slice(b, e + end.length)) + out.slice(e + end.length);
  }
}

/** Remove what the budget does not count: the tone object, the two sanctioned CSS fences, comments. */
export function prepare(rel, raw) {
  let t = raw;
  if (rel === 'components/browse/tokens.ts') t = t.replace(/export const tone = \{[\s\S]*?\} as const;/, keepNewlines);
  if (rel === 'app/globals.css') {
    t = cut(t, '/* tone-mirror:begin */', '/* tone-mirror:end */');
    t = cut(t, '/* legacy-marketplace:begin */', '/* legacy-marketplace:end */');
  }
  return stripComments(t, rel.endsWith('.css'));
}

/** Read the hex values of `export const tone = { ... } as const;` from a tokens.ts source. */
export function parseToneHex(tokensSource) {
  const m = tokensSource.match(/export const tone = \{([\s\S]*?)\} as const;/);
  if (!m) return [];
  return [...m[1].matchAll(/#([0-9a-fA-F]{6})\b/g)].map((x) => x[1].toUpperCase());
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || p.endsWith(path.join('components', 'marketplace'))) continue;
      walk(p, out);
    } else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
}

export const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
export const URLHEX = /%23(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
export const SIZE = /(^|[^A-Za-z0-9_-])((?:[a-z0-9_\-\[\]&:>*]+:)*)text-(\[[0-9.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)(?![A-Za-z0-9_-])/g;
export const RGBA = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)/g;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * The budget scan over the renter surfaces: every *.ts|*.tsx|*.css under app/ and components/,
 * excluding components/marketplace/** and *.test.*.
 * @param {{ root?: string, toneHex?: string[], hexExceptions?: typeof HEX_EXCEPTIONS }} [opts]
 */
export function scan({ root = process.cwd(), toneHex = AC1_TONE_HEX, hexExceptions = HEX_EXCEPTIONS } = {}) {
  /** @type {string[]} */
  const abs = [];
  walk(path.join(root, 'app'), abs);
  walk(path.join(root, 'components'), abs);
  const tone = toneHex.map((h) => h.replace(/^#/, '').toUpperCase());
  const toneRgb = new Set(tone.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')));
  const r = {
    /** @type {string[]} */ files: [],
    /** @type {string[]} */ hexViolations: [],
    /** @type {{ file: string, line: number, value: string }[]} */ hexSites: [],
    hexAllowed: 0,
    /** @type {Record<string, number>} */ hexByValue: {},
    url: 0,
    /** @type {string[]} */ urlValues: [],
    /** @type {string[]} */ sizeViolations: [],
    /** @type {{ file: string, line: number, token: string }[]} */ sizeSites: [],
    sizeExempt: 0,
    /** @type {Record<string, number>} */ sizeByToken: {},
    rgba: 0,
    /** @type {Record<string, number>} */ rgbaByFile: {},
  };
  for (const f of abs.sort()) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    r.files.push(rel);
    const t = prepare(rel, fs.readFileSync(f, 'utf8'));
    const allowed = new Set((hexExceptions.find((x) => x.file === rel)?.values) || []);
    for (const m of t.matchAll(HEX)) {
      const v = m[0].slice(1).toUpperCase();
      r.hexByValue[v] = (r.hexByValue[v] || 0) + 1;
      if (allowed.has(v)) r.hexAllowed++;
      else { r.hexViolations.push(`${rel}: ${m[0]}`); r.hexSites.push({ file: rel, line: lineOf(t, m.index ?? 0), value: m[0] }); }
    }
    for (const m of t.matchAll(URLHEX)) { r.url++; r.urlValues.push(m[0].slice(3).toUpperCase()); }
    for (const m of t.matchAll(SIZE)) {
      r.sizeByToken[m[3]] = (r.sizeByToken[m[3]] || 0) + 1;
      if (SIZE_EXEMPT_DIRS.some((d) => rel.startsWith(d))) r.sizeExempt++;
      else { r.sizeViolations.push(`${rel}: text-${m[3]}`); r.sizeSites.push({ file: rel, line: lineOf(t, (m.index ?? 0) + m[1].length), token: `${m[2]}text-${m[3]}` }); }
    }
    for (const m of t.matchAll(RGBA)) {
      if (toneRgb.has(`${m[1]},${m[2]},${m[3]}`)) { r.rgba++; r.rgbaByFile[rel] = (r.rgbaByFile[rel] || 0) + 1; }
    }
  }
  return r;
}

/**
 * The ref MP-15's diff proofs compare against, set explicitly: MP15_BASE_REF=e1332a8 (the merge-base
 * MP-15 was built on). The suite has two kinds of tests. Checks that stay true after merge (budget, type
 * scale, fences, values) always run and fail loudly. Proofs that diff against the pre-MP-15 tree (the
 * CookieControls reversal, the scope fence, the byte-identical layout/font-face/focus-ring checks) only
 * mean something against that base: after MP-15 merges, `git merge-base HEAD origin/main` is MP-15 itself
 * and a later ticket's own edits would trip them. So they run only when MP15_BASE_REF is set, the same
 * way the runtime proofs run only with MP15_EVIDENCE_DIR; unset, they skip and say so.
 */
export const BASE_REF = process.env.MP15_BASE_REF ?? '';
export const BASE_REF_SKIP_NOTE = 'diff vs the pre-MP-15 base: runs only with MP15_BASE_REF set (e.g. MP15_BASE_REF=e1332a8); skipped when unset';

/**
 * git, for the diff proofs. A missing git or ref throws: with MP15_BASE_REF set, those tests fail loudly.
 * @param {string} root @param {string[]} args
 */
export function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** The merge-base of HEAD with MP15_BASE_REF. Throws when it is unset (no silent fallback). @param {string} root */
export function mergeBase(root) {
  if (!BASE_REF) throw new Error('MP15_BASE_REF is not set: the diff proofs need the pre-MP-15 base, e.g. MP15_BASE_REF=e1332a8');
  return git(root, ['merge-base', 'HEAD', BASE_REF]).trim();
}

/** A file's text at a ref. @param {string} root @param {string} ref @param {string} rel */
export function showAt(root, ref, rel) {
  return git(root, ['show', `${ref}:${rel}`]);
}

/**
 * Compile through PostCSS + Tailwind with a real config (content replaced by the given raw text).
 * Returns the CSS and a lookup: decls(className) -> "prop:value" strings of every rule whose
 * selector is that class (pseudo-classes/elements after it allowed), values lowercased, since
 * hex case carries no meaning.
 * @param {any} config @param {string[]} classes @param {string} [css] @param {string} [from]
 */
export async function compileWith(config, classes, css = '@tailwind utilities;', from = undefined) {
  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('tailwindcss');
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes.join(' ') || 'block', extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process(css, { from });
  /** @type {{ selector: string, decls: string[], rule: any }[]} */
  const rules = [];
  result.root.walkRules((rule) => {
    const decls = [];
    rule.each((node) => { if (node.type === 'decl') decls.push(`${node.prop}:${node.value.toLowerCase()}`); });
    rules.push({ selector: rule.selector, decls, rule });
  });
  /** @param {string} cls */
  const decls = (cls) => {
    const want = `.${cls}`;
    const out = [];
    for (const r of rules) {
      for (const sel of r.selector.split(',').map((s) => s.trim().replace(/\\(.)/g, '$1'))) {
        if (sel === want || (sel.startsWith(want) && /^[: ]/.test(sel.slice(want.length)))) { out.push(...r.decls); break; }
      }
    }
    return out;
  };
  /** Declarations of every rule whose selector is exactly `selector` (element or pseudo selectors). @param {string} selector */
  const bySelector = (selector) => rules.filter((r) => r.selector === selector).flatMap((r) => r.decls);
  return { css: result.css, rules, decls, bySelector };
}

/** True when the report breaks the budget (the CLI's exit 1). */
export function overBudget(r) {
  return r.hexViolations.length > 0 || r.sizeViolations.length > 0 || r.rgba > RGBA_CEILING || r.url !== 1;
}

function cli() {
  const argv = process.argv;
  const at = argv.indexOf('--root');
  const root = path.resolve(at > 0 ? argv[at + 1] : process.cwd());
  const toneHex = argv.includes('--ac1')
    ? AC1_TONE_HEX
    : parseToneHex(fs.readFileSync(path.join(root, 'components/browse/tokens.ts'), 'utf8'));
  const r = scan({ root, toneHex });
  const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])));
  console.log('files scanned:', r.files.length, '| tone values:', toneHex.length);
  console.log('HEX violations (to reach 0):', r.hexViolations.length, '| sanctioned exceptions:', r.hexAllowed);
  console.log('  by value:', sorted(r.hexByValue));
  console.log('%23 url-encoded hex (exactly 1 allowed, = goldInk):', r.url, r.urlValues.join(' '));
  console.log('OFF-SCALE size violations (to reach 0):', r.sizeViolations.length, '| exempt (analytics zone):', r.sizeExempt);
  console.log('  by token:', sorted(r.sizeByToken));
  console.log('RGBA restatements of tone colours (ratchet, max 25):', r.rgba);
  if (argv.includes('--list')) {
    for (const s of r.hexSites) console.log(`HEX  ${s.file}:${s.line}: ${s.value}`);
    for (const s of r.sizeSites) console.log(`SIZE ${s.file}:${s.line}: ${s.token}`);
  }
  if (argv.includes('--check')) process.exit(overBudget(r) ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) cli();
