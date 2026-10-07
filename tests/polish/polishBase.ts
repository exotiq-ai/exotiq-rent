// MP-25 base recordings and pure checks shared by the four tests/polish files. Not a test file.
// Every check takes its inputs as arguments, so a test can run it on a planted copy first (proving it
// can see the defect) and on the real tree last. Recordings live in tests/polish/golden/ and are
// written once, from the branch base, before the first source edit (the recorder in
// polish.calendar.test.tsx refuses otherwise).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tone } from '@/components/browse/tokens';
import { stripComments } from '../design/lib/scan.mjs';
import { classes, elements, parseHtml } from '../fees/fixtures';
import { boxesByFile, goldByFile, literals, prepare, renterFiles, sliceFunction } from '../restraint/restraintScan';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const GOLDEN = fileURLToPath(new URL('./golden/', import.meta.url));
export const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');
export const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
export const git = (...args: string[]): string => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
export const readGolden = <T>(name: string): T => JSON.parse(readFileSync(join(GOLDEN, name), 'utf8')) as T;

export const DATES = 'components/drive-exotiq/flow/DatesStep.tsx';
export const SHARED = 'components/drive-exotiq/flow/shared.tsx';
export const STEPS = 'components/drive-exotiq/flow/steps.ts';
export const PAGER = 'components/drive-exotiq/flow/monthPager.ts';
export const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
export const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
export const FLOW = 'components/drive-exotiq/BookingFlow.tsx';
export const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
export const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
export const SF = 'app/[operatorSlug]/page.tsx';
export const TOKENS = 'components/browse/tokens.ts';
export const SITEBAR = 'components/browse/SiteBar.tsx';
export const CSS = 'app/globals.css';
export const OVERSCROLL = 'overscroll-y-contain';
/** The seven browsable months at the MP-26 fixed clock (NOW_ISO 2026-11-01): Jan and May 2027 have six week rows. */
export const MONTHS = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'] as const;

// ---- the pure pager helper, loaded by path so a missing file is a red test, not a type error ----
export type Pager = {
  SETTLE_MS: number;
  lockAxis(dx: number, dy: number): 'x' | 'y' | null;
  dragOffset(dx: number, canPrev: boolean, canNext: boolean, width: number): number;
  releaseVelocity(samples: { x: number; y: number; t: number }[]): number;
  pageDecision(input: { dx: number; width: number; velocity: number; canPrev: boolean; canNext: boolean }): -1 | 0 | 1;
  settleTransition(reduced: boolean): string;
  prefersReducedMotion(): boolean;
  /** F1 (review): the swipe's own click is swallowed; a keyboard or assistive click (detail 0), or any later click, is not. */
  SWALLOW_MS?: number;
  swallowsClick?(deadline: number, click: { detail: number; timeStamp: number }): boolean;
};
export async function loadPager(): Promise<Pager | null> {
  const file = join(REPO, PAGER);
  return existsSync(file) ? ((await import(/* @vite-ignore */ file)) as Pager) : null;
}

// ---- AC3: the guarded selection code ----------------------------------------------------------
const GUARDED = ['const isBlocked =', 'const rangeCrossesBlocked =', 'const canContinue =', 'const [awaitingEnd, setAwaitingEnd] =', 'const startNewRange =', 'const [alertWindow, setAlertWindow] =', 'const offerAlert =', 'const selectDay ='];
/** AC3's eight guarded statements in source order, comments stripped and whitespace collapsed. */
export function guardedSelection(src: string): string {
  const code = stripComments(src);
  return GUARDED.map((head) => {
    const at = code.indexOf(`\n  ${head}`);
    if (at < 0) return `MISSING ${head}`;
    let depth = 0;
    for (let i = at + 1; i < code.length; i++) {
      const c = code[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ';' && depth === 0) return code.slice(at + 1, i + 1).replace(/\s+/g, ' ').trim();
    }
    return `UNTERMINATED ${head}`;
  }).join('\n');
}

/** AC3: the semantics of every day button in a rendered DatesStep (the visible month: the only one rendered at rest). */
export type DaySem = { name: string; pressed: string | null; current: string | null; disabled: boolean; taken: boolean };
export const daySemantics = (html: string): DaySem[] =>
  elements(parseHtml(html))
    .filter((e) => e.tag === 'button' && classes(e).includes('aspect-square'))
    .map((e) => ({ name: e.attrs['aria-label'] ?? '', pressed: e.attrs['aria-pressed'] ?? null, current: e.attrs['aria-current'] ?? null, disabled: 'disabled' in e.attrs, taken: 'data-taken' in e.attrs }));

// ---- globals.css: the polish fence, keyframes, animation shorthands ---------------------------
export const FENCE_BEGIN = '/* polish:begin (MP-25) */';
export const FENCE_END = '/* polish:end */';
export function fence(css: string): string {
  const b = css.indexOf(FENCE_BEGIN);
  const e = css.indexOf(FENCE_END);
  return b < 0 || e < b ? '' : css.slice(b + FENCE_BEGIN.length, e);
}
/** globals.css with the polish fence (and the newline that introduces it) removed: must equal the base byte for byte. */
export const withoutFence = (css: string): string => css.replace(/\n {2}\/\* polish:begin \(MP-25\) \*\/\n[\s\S]*? {2}\/\* polish:end \*\/\n/, '');
export type Keyframes = { name: string; frames: string[]; props: string[] };
export function allKeyframes(css: string): Keyframes[] {
  const out: Keyframes[] = [];
  for (const m of Array.from(css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g))) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    const frames = Array.from(css.slice(start, i - 1).matchAll(/\{([^}]*)\}/g), (f) => f[1].trim());
    out.push({ name: m[1], frames, props: Array.from(new Set(frames.flatMap((f) => Array.from(f.matchAll(/([\w-]+)\s*:/g), (p) => p[1])))) });
  }
  return out;
}
export const keyframes = (css: string, name: string): Keyframes | undefined => allKeyframes(css).find((k) => k.name === name);
/** Every `animation:` shorthand: its selector, value and time values (a second time value is a delay). */
export const animations = (css: string): { selector: string; value: string; times: string[] }[] =>
  Array.from(css.matchAll(/([^{}]+)\{[^{}]*?animation:\s*([^;]+);/g), (m) => ({ selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), value: m[2].trim(), times: m[2].match(/(?<![\w.])[\d.]+m?s\b/g) ?? [] }));
export const ms = (t: string | undefined): number => (!t ? NaN : t.endsWith('ms') ? Number(t.slice(0, -2)) : Number(t.slice(0, -1)) * 1000);

// ---- the glass recipe -------------------------------------------------------------------------
export const RT = '[@media(prefers-reduced-transparency:reduce)]';
export function alphaOf(recipe: string): number {
  const m = /(?:^|\s)bg-ground\/(?:(\d{2})|\[(0?\.\d+)\])(?:\s|$)/.exec(recipe);
  return m ? (m[1] ? Number(m[1]) / 100 : Number(m[2])) : NaN;
}
export function blurOf(recipe: string): number {
  const m = /(?:^|\s)backdrop-blur-(md|lg|xl|\[(\d+)px\])(?:\s|$)/.exec(recipe);
  return !m ? NaN : m[2] ? Number(m[2]) : ({ md: 12, lg: 16, xl: 24 } as Record<string, number>)[m[1]];
}
/** AC6's static clauses on the recipe and its hand-written Safari twin in the polish fence. */
export function recipeProblems(recipe: string, css: string): string[] {
  const p: string[] = [];
  const toks = recipe.split(/\s+/);
  const a = alphaOf(recipe);
  const b = blurOf(recipe);
  if (!(a >= 0.9 && a <= 0.92)) p.push(`ground alpha ${a} (0.90-0.92)`);
  if (!(b >= 12 && b <= 24)) p.push(`backdrop blur ${b}px (12-24)`);
  for (const t of ['border-line/70', 'glass-bar-twin', `${RT}:bg-ground`, `${RT}:backdrop-blur-none`]) if (!toks.includes(t)) p.push(`recipe lacks ${t}`);
  if (/gold|shadow|rgba?\(|#[0-9a-f]{3,8}\b/i.test(recipe)) p.push('recipe carries gold, a shadow or a raw colour');
  const f = fence(css);
  const twin = /\.glass-bar-twin\s*\{\s*\/\* autoprefixer: ignore next \*\/\s*-webkit-backdrop-filter:\s*blur\((\d+)px\);\s*\}/.exec(f);
  if (!twin) p.push('no .glass-bar-twin with an ignored -webkit-backdrop-filter in the polish fence');
  else if (Number(twin[1]) !== b) p.push(`the twin blurs ${twin[1]}px, the recipe ${b}px`);
  if (!/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.glass-bar-twin\s*\{\s*\/\* autoprefixer: ignore next \*\/\s*-webkit-backdrop-filter:\s*none;\s*\}\s*\}/.test(f)) p.push('the twin has no reduced-transparency reset');
  return p;
}
const TONE_TEXT = /(?:^|[\s'"`:])text-([a-zA-Z0-9]+)(?![\w/-])/g;
const textTones = (s: string): string[] => Array.from(s.matchAll(TONE_TEXT), (m) => m[1]).filter((k) => k in tone);
const sliceFrom = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from);
  if (a < 0) return '';
  const b = src.indexOf(to, a + from.length);
  return src.slice(a, b < 0 ? undefined : b);
};
/** Every tone a text inside the site bar can wear: SiteBar, SavedLink, the children each host passes, the desktop navs, the inherited host colour. */
export function barTextTones(): string[] {
  const sources = [
    stripComments(read(SITEBAR)),
    stripComments(read('components/renters/SavedLink.tsx')),
    sliceFrom(stripComments(read('components/browse/BrowseChrome.tsx')), '<SiteBar', '</SiteBar>'),
    sliceFrom(stripComments(read(CHROME)), '<SiteBar', '</SiteBar>'),
    sliceFrom(stripComments(read(VEP)), 'const desktopNav', ';\n'),
    sliceFrom(stripComments(read(SF)), 'const desktopNav', ';\n'),
  ];
  const hosts = ['components/browse/BrowseChrome.tsx', CHROME, 'components/browse/PageFrame.tsx'].filter((h) => /(^|[\s`'"])text-ink(?![\w/-])/.test(read(h)));
  return Array.from(new Set([...sources.flatMap(textTones), ...(hosts.length ? ['ink'] : [])])).sort();
}

// ---- census (AC12) and glass sites (AC6) ------------------------------------------------------
export function shadowSites(): string[] {
  const out: string[] = [];
  for (const rel of renterFiles()) {
    const text = prepare(rel, read(rel));
    for (const t of text.split(/[\s'"`{};]+/)) if (/(?:^|:)shadow(?:-\[|-(?:sm|md|lg|xl|2xl|inner)$|$)/.test(t)) out.push(`${rel} ${t}`);
    for (const _ of Array.from(text.matchAll(/\bboxShadow\b|box-shadow\s*:/g))) out.push(`${rel} box-shadow`);
  }
  return out.sort();
}
export function activeByFile(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of renterFiles()) {
    const n = prepare(rel, read(rel)).split(/[\s'"`{};]+/).filter((t) => /(?:^|:)active:/.test(t)).length;
    if (n) out[rel] = n;
  }
  return out;
}
const walk = (dir: string): string[] =>
  existsSync(join(REPO, dir))
    ? readdirSync(join(REPO, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === '.next' ? [] : walk(`${dir}/${e.name}`)) : [`${dir}/${e.name}`]))
    : [];
/** Every .ts/.tsx/.css source under app/ and components/ (marketplace and tests skipped). */
export const sourceFiles = (): string[] => [...walk('app'), ...walk('components')].filter((r) => /\.(tsx?|css)$/.test(r) && !r.startsWith('components/marketplace/') && !/\.test\./.test(r)).sort();
/** The trimmed lines of a prepared text that apply a backdrop filter (a line that only removes one, a none, is not glass). */
export const glassLines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter((l) => /backdrop-blur(?!-none\b)|backdrop-filter:\s*(?!none\b)|backdropFilter/.test(l));
/** Backdrop-filter lines per file (comments stripped). The five over-photo sites are the base's; ConfirmationScreen's badge is an allowed exception (errata 2). */
export function glassSites(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rel of sourceFiles()) {
    const lines = glassLines(prepare(rel, read(rel)));
    if (lines.length) out[rel] = lines;
  }
  return out;
}
/** Every .css file under a built CSS directory (MP25_BUILT_CSS_DIR, e.g. .next/static/css), concatenated. */
export function builtCss(dir: string): string {
  const files = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : n.endsWith('.css') ? [join(d, n)] : []));
  return files(dir).map((f) => readFileSync(f, 'utf8')).join('\n');
}
/** Class tokens that would make an element the containing block of a fixed descendant (finding 8: anchored, so overscroll-y-contain is not "contain"). */
export const captureTokens = (classString: string): string[] =>
  classString.split(/[\s`]+/).filter((t) => /^-?(?:transform(?:-gpu|-cpu)?|filter|blur(?:-.+)?|brightness-.+|backdrop-.+|perspective(?:-.+)?|contain-.+|will-change-.+|translate-[xy]-.+|scale(?:-[xy])?-.+|rotate-.+|skew-[xy]-.+)$/.test(t.split(':').pop() ?? ''));
export const cookieMounts = (): string[] =>
  [...walk('app'), ...walk('components')]
    .filter((r) => /\.tsx$/.test(r) && !r.startsWith('components/analytics/') && !r.startsWith('components/marketplace/') && !/\.test\./.test(r))
    .flatMap((r) => read(r).split('\n').filter((l) => l.includes('<CookieControls')).map((l) => `${r}: ${l.trim()}`))
    .sort();
export function census() {
  const gold = goldByFile();
  return { gold, goldTotal: Object.values(gold).reduce((a, b) => a + b, 0), boxes: boxesByFile(), shadows: shadowSites(), active: activeByFile(), glass: glassSites(), toneKeys: Object.keys(tone).sort(), mounts: cookieMounts() };
}
export type Census = ReturnType<typeof census>;
export type CensusFile = Census & { cutFrom: string; frozen: Record<string, string>; projections: Record<string, string>; datesLiterals: string[] };
export const baseCensus = (): CensusFile => readGolden<CensusFile>('census.base.json');
export function censusProblems(base: Census, now: Census): string[] {
  const p: string[] = [];
  for (const f of Array.from(new Set([...Object.keys(base.gold), ...Object.keys(now.gold)]))) if ((now.gold[f] ?? 0) !== (base.gold[f] ?? 0)) p.push(`gold ${f}: ${now.gold[f] ?? 0}, base ${base.gold[f] ?? 0}`);
  if (now.goldTotal !== base.goldTotal || now.goldTotal > 43) p.push(`gold total ${now.goldTotal}, base ${base.goldTotal}, ceiling 43`);
  for (const f of Array.from(new Set([...Object.keys(base.boxes), ...Object.keys(now.boxes)]))) if ((now.boxes[f] ?? 0) !== (base.boxes[f] ?? 0)) p.push(`boxes ${f}: ${now.boxes[f] ?? 0}, base ${base.boxes[f] ?? 0}`);
  if (JSON.stringify(now.shadows) !== JSON.stringify(base.shadows)) p.push(`shadow sites changed: ${now.shadows.filter((s) => !base.shadows.includes(s)).join(', ') || 'one removed'}`);
  if (JSON.stringify(now.toneKeys) !== JSON.stringify(base.toneKeys)) p.push(`tone keys changed: ${now.toneKeys.join(',')}`);
  return p;
}

// ---- scope (AC13): frozen files, and the projections that must equal the base ----------------
export const LOCKSTEP = ['tests/fees/goldens.ts', 'tests/fees/golden/dates-step.html', 'tests/fees/golden/driver-step.html', 'tests/fees/golden/base.json', 'tests/fees/fees.flow.test.ts', 'tests/fees/fees.golden.test.tsx', 'tests/chrome/chrome.frame.test.tsx'];
export const lockstepPaths = (): string[] => [...LOCKSTEP, ...walk('tests/bars').filter((r) => /\.tsx?$/.test(r))].sort();
export const copyName = (rel: string): string => `${rel.replace(/[/[\]]/g, '__')}.txt`;
export const lockstepCopy = (rel: string): string => readFileSync(join(GOLDEN, 'lockstep-base', copyName(rel)), 'utf8');
/**
 * Every file MP-25 must leave byte-identical: the whole app, component, domain, docs/analytics, scripts and test
 * trees (money, consent, chrome, foundations, every other test), less the files MP-25 may touch, its own
 * tests/polish and the tests/bars lockstep files (which lockstepProblems pins hunk by hunk instead).
 */
export function frozenPaths(): string[] {
  const touched = new Set([DATES, SHARED, STEPS, PAGER, VEP, SF, TOKENS, SITEBAR, CSS, ...LOCKSTEP]);
  return [
    'tailwind.config.ts', 'postcss.config.js', 'package.json', 'package-lock.json', 'vitest.config.mts', 'tsconfig.json', 'next.config.js', 'next.config.mjs',
    ...['app', 'components', 'domain', 'docs/analytics', 'scripts', 'tests'].flatMap(walk),
  ].filter((p, i, all) => existsSync(join(REPO, p)) && !touched.has(p) && !p.endsWith('.DS_Store') && !p.startsWith('components/marketplace/') && !p.startsWith('tests/polish/') && !p.startsWith('tests/bars/') && all.indexOf(p) === i).sort();
}
const swapOnce = (s: string, from: string, to: string): string => (s.split(from).length === 2 ? s.replace(from, to) : s);
/** Maps that take a touched file back to its base text (or to a part that must not move); at the base they are the identity. */
export const PROJECT: Record<string, (s: string) => string> = {
  [STEPS]: (s) => swapOnce(s, "{ key: 'review', label: 'Review' }", "{ key: 'review', label: 'Review & Request' }"),
  [VEP]: (s) => swapOnce(s, ` ${OVERSCROLL}`, ''),
  [SF]: (s) => swapOnce(s, ` ${OVERSCROLL}`, ''),
  [TOKENS]: (s) => s.replace(/\n\/\*\*(?:(?!\*\/)[\s\S])*\*\/\nexport const glassBarClassName =[\s\S]*?;\n/, ''),
  [CSS]: withoutFence,
  [SHARED]: (s) => s.replace(sliceFunction(s, 'ScreenShell'), ''),
  'DatesStep.head': (s) => s.slice(s.indexOf('const PICKUP_TIMES'), s.indexOf('export function DatesStep')),
  'DatesStep.tail': (s) => s.slice(s.lastIndexOf('\n', s.indexOf('Tap start, then end'))),
};
export const projectionSource = (key: string): string => (key.startsWith('DatesStep.') ? DATES : key);
export function frozenProblems(base: CensusFile, reader: (rel: string) => string): string[] {
  return Object.entries(base.frozen).filter(([rel]) => !PROTECT_LOCKSTEP.includes(rel)).flatMap(([rel, hash]) => (!existsSync(join(REPO, rel)) ? [`${rel} is gone`] : sha(reader(rel)) !== hash ? [`${rel} changed`] : []));
}
/** The class literal of a phone scroller (the one literal holding the contiguous scroll run). */
export const scrollerLiteral = (rel: string): string => literals(stripComments(read(rel))).find((s) => s.includes('min-h-0 flex-1 overflow-y-auto')) ?? '';
export const projections = (): Record<string, string> => Object.fromEntries(Object.entries(PROJECT).map(([k, f]) => [k, sha(f(read(projectionSource(k))))]));

// ---- lockstep (AC14) --------------------------------------------------------------------------
export type Hunk = { removed: string[]; added: string[] };
/** Line hunks between two texts (LCS; the files are a few hundred lines). */
export function hunks(before: string, after: string): Hunk[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const L = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Hunk[] = [];
  let open = false;
  let i = 0;
  let j = 0;
  const top = (): Hunk => {
    if (!open) { out.push({ removed: [], added: [] }); open = true; }
    return out[out.length - 1];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { open = false; i++; j++; }
    else if (j < b.length && (i === a.length || L[i][j + 1] >= L[i + 1][j])) top().added.push(b[j++]);
    else top().removed.push(a[i++]);
  }
  return out;
}
const NAV_ROW = '<div class="mt-4 flex items-center justify-between px-1">';
/** The base Dates golden with its calendar region (navigation row to the hint line) cut by bytes: L1's derivation. */
export function cutCalendarBytes(html: string): string {
  const start = html.indexOf(NAV_ROW);
  const end = html.lastIndexOf('<div', html.indexOf('Tap start, then end'));
  if (start < 0 || html.indexOf(NAV_ROW, start + 1) >= 0 || end <= start) throw new Error('calendar region not found exactly once');
  return `${html.slice(0, start)}«calendar»${html.slice(end)}`;
}
export const firstClass = (html: string): string => /^<div class="([^"]*)"/.exec(html)?.[1] ?? '';
export const withFirstClass = (html: string, cls: string): string => html.replace(/^<div class="[^"]*"/, `<div class="${cls}"`);
export const SHELL_SUFFIX = ` ${OVERSCROLL} animate-step-in`;
const swap = (h: Hunk, from: string, to: string): boolean => h.removed.length === 1 && h.added.length === 1 && h.removed[0].includes(from) && h.added[0] === h.removed[0].replace(from, to);
const FLOW_IMPORT = "import { FLOW_STEPS } from '@/components/drive-exotiq/flow/steps';";
// ---- driver errata #3: MP-30's restoration goldens join the lockstep ----------------------------
/** The tests/protect files errata #3 admits: seven goldens, their base.json, and the restore test's calendar cut. */
export const PROTECT_REVIEW = ['review-FX-T1S1P1.html', 'review-FX-T1S1P0.html', 'review-FX-T1S1P1-requesting.html', 'review-mock-no-quote.html'];
export const PROTECT_STOREFRONT = ['storefront-about.html', 'storefront-no-about.html'];
export const PROTECT_FLOW = 'bookingflow-first-render.html';
const PG = 'tests/protect/golden/';
export const PROTECT_RESTORE = 'tests/protect/protect.restore.test.tsx';
export const PROTECT_LOCKSTEP = [...[...PROTECT_REVIEW, ...PROTECT_STOREFRONT, PROTECT_FLOW, 'base.json'].map((n) => PG + n), PROTECT_RESTORE];
/** A file's text at the recorded branch base (errata #3 postdates the T0 byte copies; git holds the base exactly). */
export const atBase = (rel: string): string => execFileSync('git', ['show', `${baseCensus().cutFrom}:${rel}`], { cwd: REPO, encoding: 'utf8' });
const SHELL_BASE = 'min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] pb-5';
const replaceOnce = (s: string, from: string, to: string): string => (s.split(from).length === 2 ? s.replace(from, to) : `${s}\n«${from} not found exactly once»`);
/** The one glass recipe as SiteBar renders it (read from tokens.ts by the caller, so this file imports no recipe). */
export function protectExpected(rel: string, base: string, recipe: string): string {
  const name = rel.slice(PG.length);
  const shell = (h: string) => replaceOnce(h, `<div class="${SHELL_BASE}"`, `<div class="${SHELL_BASE}${SHELL_SUFFIX}"`);
  if (PROTECT_REVIEW.includes(name)) return shell(base);
  if (PROTECT_STOREFRONT.includes(name)) {
    const bar = replaceOnce(base, 'class="sticky top-0 z-40 border-b border-line/70 bg-ground/85 backdrop-blur-md ', `class="sticky top-0 z-40 border-b ${recipe} `);
    return replaceOnce(bar, 'overflow-y-auto px-4 pt-2 [scrollbar-width:none] pb-5 lg:overflow-visible', `overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${OVERSCROLL} pb-5 lg:overflow-visible`);
  }
  if (name === PROTECT_FLOW) return cutCalendarBytes(replaceOnce(shell(base), '>Review &amp; Request</span>', '>Review</span>'));
  return base;
}
/** Errata #3: the protect goldens equal their base bytes with exactly the polish substitutions; base.json moves only their hashes; the restore test gains the calendar cut and nothing else. */
export function protectLockstepProblems(cur: (rel: string) => string, recipe: string): string[] {
  const p: string[] = [];
  for (const rel of PROTECT_LOCKSTEP.filter((r) => r.endsWith('.html'))) if (cur(rel) !== protectExpected(rel, atBase(rel), recipe)) p.push(`${rel} differs from its base golden beyond the polish substitutions`);
  const b0 = JSON.parse(atBase(`${PG}base.json`));
  const b1 = JSON.parse(cur(`${PG}base.json`));
  for (const rel of PROTECT_LOCKSTEP.filter((r) => r.endsWith('.html'))) {
    const n = rel.slice(PG.length);
    if (b1.files[n] !== sha(cur(rel))) p.push(`${PG}base.json does not hold ${n}'s hash`);
    delete b0.files[n];
    delete b1.files[n];
  }
  if (JSON.stringify(b0) !== JSON.stringify(b1)) p.push(`${PG}base.json changed beyond the seven hashes`);
  const hs = hunks(atBase(PROTECT_RESTORE), cur(PROTECT_RESTORE));
  const imp = hs.some((h) => h.removed.length === 0 && h.added.length === 1 && h.added[0] === "import { calendarRange } from '../fees/goldens';");
  const cut = hs.some((h) => h.removed.length === 1 && h.removed[0].startsWith('const flow = () => renderToStaticMarkup(') && h.added.length === 2 && h.added[0].startsWith('/**') && h.added[1].startsWith('const flow = () => ') && h.added[1].includes('calendarRange(parseHtml(') && h.added[1].includes('«calendar»'));
  if (hs.length !== 2 || !imp || !cut) p.push(`${PROTECT_RESTORE}: ${JSON.stringify(hs)}`);
  return p;
}

/** AC14: the lockstep files differ from their base copies by the named amendments and nothing else. */
export function lockstepProblems(copy: (rel: string) => string, cur: (rel: string) => string): string[] {
  const p: string[] = [];
  const hs = (rel: string) => hunks(copy(rel), cur(rel));
  const flow = hs('tests/fees/fees.flow.test.ts');
  if (flow.length !== 1 || !swap(flow[0], "'Review & Request']", "'Review']")) p.push(`tests/fees/fees.flow.test.ts: ${JSON.stringify(flow)}`);
  const frame = hs('tests/chrome/chrome.frame.test.tsx');
  const ok = [
    frame.some((h) => h.removed.length === 0 && h.added.length === 1 && h.added[0] === FLOW_IMPORT),
    frame.some((h) => swap(h, "const LABELS = ['Dates', 'Driver', 'Review & Request'];", "const LABELS = ['Dates', 'Driver', 'Review'];")),
    frame.some((h) => swap(h, 'Dates, Driver and Review & Request and marks', 'Dates, Driver and Review and marks')),
    frame.some((h) => h.removed.length === 1 && h.added.length === 1 && h.removed[0].includes('(?! & Request)') && h.added[0].includes('JSON.stringify(FLOW_STEPS.map((s) => s.label))')),
  ];
  if (frame.length !== 4 || ok.includes(false)) p.push(`tests/chrome/chrome.frame.test.tsx: ${JSON.stringify(frame)}`);
  const golden = hs('tests/fees/fees.golden.test.tsx');
  if (golden.length !== 1 || !swap(golden[0], "replace('grid grid-cols-7', 'grid grid-cols-6')", "replace('min-h-0 flex-1', 'min-h-0 flex-2')")) p.push(`tests/fees/fees.golden.test.tsx: ${JSON.stringify(golden)}`);
  const cuts = hs('tests/fees/goldens.ts');
  const exportsAdded = cuts.flatMap((h) => h.added).filter((l) => /^export /.test(l));
  if (cuts.length !== 1 || cuts[0].removed.length !== 2 || !cuts[0].removed[1].startsWith('export const cutDates =') || exportsAdded.length !== 2 || !exportsAdded.some((l) => l.startsWith('export function cutDates(')) || !exportsAdded.some((l) => l.startsWith('export function calendarRange('))) p.push(`tests/fees/goldens.ts: ${JSON.stringify(cuts)}`);
  const d0 = copy('tests/fees/golden/dates-step.html');
  const d1 = cur('tests/fees/golden/dates-step.html');
  if (firstClass(d1) !== firstClass(d0) + SHELL_SUFFIX || withFirstClass(cutCalendarBytes(d0), firstClass(d1)) !== d1) p.push('tests/fees/golden/dates-step.html changed beyond the calendar placeholder and the scroller class');
  const v0 = copy('tests/fees/golden/driver-step.html');
  const v1 = cur('tests/fees/golden/driver-step.html');
  if (firstClass(v1) !== firstClass(v0) + SHELL_SUFFIX || withFirstClass(v0, firstClass(v1)) !== v1) p.push('tests/fees/golden/driver-step.html changed beyond the scroller class');
  const b0 = JSON.parse(copy('tests/fees/golden/base.json'));
  const b1 = JSON.parse(cur('tests/fees/golden/base.json'));
  for (const k of ['dates-step.html', 'driver-step.html']) { delete b0.files[k]; delete b1.files[k]; }
  if (JSON.stringify(b0) !== JSON.stringify(b1)) p.push('tests/fees/golden/base.json changed beyond the two hashes');
  for (const rel of lockstepPaths().filter((r) => r.startsWith('tests/bars/'))) {
    for (const h of hs(rel)) {
      const pure = h.removed.length === 0 && h.added.every((l) => l.includes(OVERSCROLL));
      const swapped = h.removed.length === h.added.length && h.added.every((l, k) => [/'overscroll-y-contain',\s?/, /,\s?'overscroll-y-contain'/, /"overscroll-y-contain",\s?/, / ?overscroll-y-contain/].some((re) => l.replace(re, '') === h.removed[k]));
      if (!pure && !swapped) p.push(`${rel}: a hunk beyond admitting ${OVERSCROLL}: ${JSON.stringify(h)}`);
    }
  }
  return p;
}
