// MP-28 recipe tests (AC1, AC2, AC3, AC4, AC6, AC7): the pinned phone bar is one in-flow recipe, the
// last child of the frame's column after its scroller, with the safe area inside its own bottom
// padding, and the scrollers end in one small clearance constant. Source scans, one render of the
// flow frame and one Tailwind compile through the repo's real config. The browser proof (the seam,
// the ground, the safe-area inset at 34px) is the verify lane's probe, not a unit test.
//
// Each check is a pure function. The planted bad inputs run FIRST in every test, so a checker that
// can no longer fail is caught even on a tree where the real files are still wrong. On the base the
// real-file assertions of AC1, AC2, AC3, AC4, AC7 are red by design (they read the new recipe, the
// pinned-bar hook and the clearance constant); AC6 pins bytes that must not move and is green on the
// base and after.
//
// This file lives under tests/bars/, outside Tailwind's content globs: it may quote utilities.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { ScreenShell, Sticky } from '@/components/drive-exotiq/flow/shared';
import { compileWith, stripComments } from '../design/lib/scan.mjs';
import { type El, byAttr, classes, parseHtml } from '../fees/fixtures';
import { openTags, sliceFunction } from '../restraint/restraintScan';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
/** Comments out: a comment may quote a class without it counting as markup. */
const prepared = (rel: string) => stripComments(read(rel));
const tokensOf = (cls: string) => cls.split(/\s+/).filter(Boolean);
const rawTokens = (text: string) => text.split(/[\s'"`{}]+/).filter(Boolean);

const TOKENS = 'components/browse/tokens.ts';
const SHARED = 'components/drive-exotiq/flow/shared.tsx';
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const SF = 'app/[operatorSlug]/page.tsx';
const LAYOUT = 'app/layout.tsx';
const STEPS = ['components/drive-exotiq/flow/DatesStep.tsx', 'components/drive-exotiq/flow/DriverStep.tsx', 'components/drive-exotiq/flow/ReviewStep.tsx'];

const HOOK = 'data-chrome="pinned-bar"';
const SAFE_PAD = 'pb-[max(1rem,env(safe-area-inset-bottom))]';
const SHADOW = 'shadow-[0_-24px_42px_rgba(13,15,20,.96)]';
/** The recipe as the spec writes it: the positive control for the checker, never read from the repo. */
const GOOD = `relative z-10 shrink-0 border-t border-line bg-panel px-4 ${SAFE_PAD} pt-3 ${SHADOW}`;
/** The recipe on main before MP-28. */
const BASE_RECIPE = 'absolute left-0 right-0 z-10 border-t border-line bg-panel px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)]';
/** The three bottom offsets MP-28 removes (whole tokens, anywhere under app/ and components/). */
const OFFSETS = ['bottom-4', 'md:bottom-5', 'bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+8px))]'];
/** The exact opening tags: the flow footer, and the vehicle and storefront bars (phone only). */
const FLOW_TAG = `<div ${HOOK} className={stickyBarClassName}>`;
const PAGE_TAG = `<div ${HOOK} className={\`\${stickyBarClassName} lg:hidden\`}>`;
/** The one clearance constant (the driver's ruling: pb-5, 20px; the spec's band is pb-4 to pb-6). */
const CLEARANCE = 'pb-5';
const BAND = ['pb-4', 'pb-5', 'pb-6'];
/** Phone bottom paddings the footprint guesses used: none may remain on a bar surface. */
const GUESSES = ['pb-52', 'pb-48', 'pb-64'];
const SCROLLER = 'min-h-0 flex-1 overflow-y-auto';

/** Every lg: token in each page's source on main, in source order (derived once with lgTokens(), then pinned). */
const LG_VEP = ['lg:overflow-visible', 'lg:px-8', 'lg:pb-20', 'lg:pt-8', 'lg:grid', 'lg:grid-cols-[minmax(0,1fr)_22rem]', 'lg:items-start', 'lg:gap-x-12', 'lg:mt-6', 'lg:grid-cols-4', 'lg:hidden', 'lg:block', 'lg:hidden'];
const LG_SF = ['lg:py-32', 'lg:overflow-visible', 'lg:px-8', 'lg:pb-20', 'lg:pt-8', 'lg:grid', 'lg:grid-cols-[minmax(0,1fr)_20rem]', 'lg:items-start', 'lg:gap-x-12', 'lg:mx-0', 'lg:mt-0', 'lg:aspect-[21/9]', 'lg:rounded-2xl', 'lg:mt-6', 'lg:text-display', 'lg:leading-[1.12]', 'lg:hidden', 'lg:mt-8', 'lg:hidden', 'lg:hidden', 'lg:-mx-1', 'lg:-my-1', 'lg:block', 'lg:space-y-4', 'lg:px-1', 'lg:py-1', 'lg:hidden'];
const lgTokens = (rel: string) => prepared(rel).split(/[\s'"`{}]+/).filter((t) => /(^|:)lg:/.test(t));

/** Repo-relative source files under `dir` (recursive); tests and the legacy marketplace mockup skipped. */
function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(join(REPO, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace' && e.name !== 'node_modules' && e.name !== '.next') walk(rel); }
      else if (/\.(tsx?|mts|m?js|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}
const allSources = () => [...sources('app'), ...sources('components')];

/** The className expression of an opening tag (a plain string or a template literal). */
function classOfTag(tag: string): string {
  const m = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag);
  return m ? (m[1] ?? m[2] ?? '') : '';
}
const scrollerTag = (rel: string, tag: 'div' | 'section') => openTags(prepared(rel), tag).find((t) => t.includes(SCROLLER)) ?? '';

/** Everything wrong with a recipe string (AC1 and AC7): empty means a good in-flow recipe. */
function recipeProblems(cls: string): string[] {
  const t = tokensOf(cls);
  const p: string[] = [];
  for (const need of ['relative', 'z-10', 'shrink-0', 'border-t', 'border-line', 'bg-panel', 'px-4', 'pt-3', SAFE_PAD, SHADOW]) if (!t.includes(need)) p.push(`missing ${need}`);
  for (const ban of ['absolute', 'fixed', 'sticky', 'left-0', 'right-0', 'pb-4']) if (t.includes(ban)) p.push(`still has ${ban}`);
  for (const x of t) {
    if (/(^|:)-?(top|bottom|left|right|inset)(-|$)/.test(x)) p.push(`an offset utility: ${x}`);
    if (/(^|:)(min-|max-)?h-/.test(x)) p.push(`a height utility: ${x}`);
    if (/(^|:)(p|py|pb)-/.test(x) && x !== SAFE_PAD) p.push(`a second bottom padding: ${x}`);
    if (x.includes(':')) p.push(`a variant token (the recipe is the same at every breakpoint): ${x}`);
  }
  return p;
}

/** Index of the `>` that ends the JSX tag opened at `from` (braces skipped, as openTags does). */
function tagEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}
/** Index just past the closing tag of the element opened at `open` (same-name nesting counted). */
function closeOf(src: string, open: number): number {
  const name = /^<([A-Za-z][\w.]*)/.exec(src.slice(open))?.[1] ?? '';
  const re = new RegExp(`<(/?)${name}(?=[\\s/>])`, 'g');
  re.lastIndex = open;
  let depth = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const end = tagEnd(src, m.index);
    if (m[1]) depth--;
    else if (src[end - 1] !== '/') depth++;
    if (depth === 0) return end + 1;
  }
  return -1;
}

/** The scroller then the bar, as the last two children of `<PhoneViewport>` in a page's source. */
function pageOrderProblems(label: string, src: string, tag: 'div' | 'section'): string[] {
  const p: string[] = [];
  const at = src.indexOf(SCROLLER);
  const bar = src.indexOf(PAGE_TAG);
  if (at < 0) return [`${label}: no scroller`];
  if (bar < 0) return [`${label}: no bar with the exact tag ${PAGE_TAG}`];
  const sc = src.lastIndexOf(`<${tag}`, at);
  const frame = src.lastIndexOf('<PhoneViewport', sc);
  if (frame < 0) return [`${label}: no PhoneViewport before the scroller`];
  if (!/^\s*(\{\s*\}\s*)?$/.test(src.slice(tagEnd(src, frame) + 1, sc))) p.push(`${label}: something sits between the frame and the scroller`);
  const afterScroller = closeOf(src, sc);
  if (afterScroller < 0 || afterScroller > bar || !/^\s*(\{hasPhone && \(\s*)?$/.test(src.slice(afterScroller, bar))) p.push(`${label}: the bar is not the next sibling after the scroller`);
  const afterBar = closeOf(src, bar);
  if (afterBar < 0 || !/^\s*(\)\}\s*)?<\/PhoneViewport>/.test(src.slice(afterBar))) p.push(`${label}: the bar is not the last child of the frame`);
  return p;
}

/** The flow footer as rendered inside the real frame's children wrapper. */
function flowFrameProblems(): string[] {
  const p: string[] = [];
  const Frame = PhoneViewport as unknown as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    createElement(Frame, { layout: 'panel', step: 1 }, createElement(ScreenShell, null, createElement('p', null, 'x')), createElement(Sticky, null, createElement('button', null, 'go'))),
  );
  const bars = byAttr(parseHtml(html), 'data-chrome', 'pinned-bar');
  if (bars.length !== 1) return [`flow: ${bars.length} pinned bars in one render, expected 1`];
  const bar = bars[0];
  const wrapper = bar.parent;
  const frame = wrapper?.parent;
  if (!wrapper || classes(wrapper).join(' ') !== 'flex min-h-0 flex-1 flex-col') p.push(`flow: the bar's parent is not the children wrapper (${wrapper ? classes(wrapper).join(' ') : 'none'})`);
  if (!frame || !classes(frame).includes('h-dvh') || !classes(frame).includes('overflow-hidden')) p.push('flow: the wrapper is not a direct child of the h-dvh overflow-hidden frame');
  const kids = (wrapper?.children ?? []).filter((c): c is El => typeof c !== 'string');
  if (kids[kids.length - 1] !== bar) p.push('flow: the bar is not the last element of the wrapper');
  const scroller = kids[kids.length - 2];
  if (!scroller || !SCROLLER.split(' ').every((c) => classes(scroller).includes(c))) p.push('flow: the element before the bar is not the scroller');
  for (const x of classes(bar)) if (/(^|:)-?(top|bottom|left|right|inset)(-|$)/.test(x) || x === 'absolute' || x === 'fixed') p.push(`flow: the bar is positioned by ${x}`);
  for (const x of wrapper ? classes(wrapper) : []) if (['absolute', 'fixed', 'relative'].includes(x) || (/(^|:)(min-|max-)?h-/.test(x) && x !== 'min-h-0')) p.push(`flow: the wrapper is positioned or sized by ${x}`);
  return p;
}

/** Every `<Sticky` in a step file comes right after the closing `</ScreenShell>`: the bar follows its scroller. */
function stepOrderProblems(rel: string, src: string): string[] {
  const opens = (src.match(/<Sticky(?=[\s>])/g) ?? []).length;
  const pairs = (src.match(/<\/ScreenShell>\s*<Sticky(?=[\s>])/g) ?? []).length;
  return opens === 0 ? [`${rel}: no Sticky`] : opens === pairs ? [] : [`${rel}: ${opens - pairs} of ${opens} Sticky bars do not directly follow </ScreenShell>`];
}

/** What is wrong with a surface's phone bottom padding (AC4): empty means the one ruled constant. */
const clearanceProblems = (site: string, value: string | undefined): string[] =>
  !value ? [`${site}: no phone bottom padding found`] : [...(BAND.includes(value) ? [] : [`${site}: ${value} is outside the pb-4 to pb-6 band`]), ...(value === CLEARANCE ? [] : [`${site}: ${value}, the ruled constant is ${CLEARANCE}`])];
/** The phone bottom padding of each bar surface, read from the source text. */
const flowClearance = (shell: string) => /\$\{stickySafe \? '(pb-\d+)' : 'pb-20'\}/.exec(shell)?.[1];
const vehicleClearance = (tag: string) => tokensOf(classOfTag(tag)).find((t) => /^pb-\d+$/.test(t));
const storefrontClearance = (tag: string) => /\$\{hasPhone \? '(pb-\d+)' : 'pb-8'\}/.exec(tag)?.[1];

/** A scroller's class string with its one phone bottom-padding token blanked (AC6: only that token may change). */
const blank = (cls: string) => cls.replace(/\$\{hasPhone \? '(pb-\d+)' : 'pb-8'\}/, "${hasPhone ? '«pb»' : 'pb-8'}").replace(/ pb-\d+ /, ' «pb» ');
const WANT_VEP = 'min-h-0 flex-1 overflow-y-auto px-4 «pb» pt-1 [scrollbar-width:none] lg:overflow-visible lg:px-8 lg:pb-20 lg:pt-8';
const WANT_SF = "min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${hasPhone ? '«pb»' : 'pb-8'} lg:overflow-visible lg:px-8 lg:pb-20 lg:pt-8";

describe('MP-28 pinned bar recipe (AC1, AC2, AC3, AC4, AC6, AC7)', () => {
  it('the pinned bar is one in-flow recipe with its safe area inside its own padding', () => {
    const problems: string[] = [];

    // Planted first: each of these must be caught by the same checkers the real files go through.
    expect(recipeProblems(GOOD)).toEqual([]);
    for (const bad of [
      BASE_RECIPE,
      `${GOOD} bottom-0`,
      `${GOOD} pb-4`,
      GOOD.replace(SAFE_PAD, 'pb-[env(safe-area-inset-bottom)]'),
      `${GOOD} md:bottom-5`,
      `${GOOD} h-24`,
      GOOD.replace('relative ', ''),
      GOOD.replace(' shrink-0', ''),
      `${GOOD} lg:hidden`,
    ]) expect(recipeProblems(bad), bad).not.toEqual([]);
    expect(openTags('<div className={`${stickyBarClassName} lg:hidden`}>', 'div')[0]).not.toBe(PAGE_TAG);
    expect(openTags(`<div ${HOOK} className={\`\${stickyBarClassName} bottom-4 lg:hidden\`}>`, 'div')[0]).not.toBe(PAGE_TAG);
    expect(openTags('<div className={`${stickyBarClassName} bottom-4 md:bottom-5`}>', 'div')[0]).not.toBe(FLOW_TAG);

    // The recipe.
    problems.push(...recipeProblems(tokens.stickyBarClassName).map((m) => `recipe: ${m}`));

    // The doc comment stops promising per-site offsets and quotes no utility (Tailwind scans comments).
    const doc = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export const stickyBarClassName/.exec(read(TOKENS))?.[1] ?? '';
    if (!doc) problems.push('tokens.ts: the doc comment above stickyBarClassName is gone');
    if (/bottom offset/i.test(doc)) problems.push('tokens.ts: the doc comment still says each call site keeps its own bottom offset');
    const quoted = new Set([...tokensOf(GOOD), 'absolute', 'fixed', 'left-0', 'right-0', 'bottom-0', 'pb-4', ...OFFSETS]);
    for (const w of doc.split(/\s+/).map((s) => s.replace(/^[^\w[]+|[^\w\])]+$/g, ''))) if (quoted.has(w)) problems.push(`tokens.ts: the doc comment quotes the utility ${w}`);

    // The three bars: exact opening tags, Sticky's shape, and the hook on exactly three elements.
    const sticky = sliceFunction(prepared(SHARED), 'Sticky');
    if (openTags(sticky, 'div')[0] !== FLOW_TAG) problems.push(`Sticky root is ${openTags(sticky, 'div')[0] ?? 'missing'}, expected ${FLOW_TAG}`);
    const stickyBody = sticky.slice(sticky.indexOf(FLOW_TAG) + FLOW_TAG.length);
    if (!/^\s*<CookieControls \/>\s*<div className="space-y-3">\{children\}<\/div>\s*<\/div>/.test(stickyBody)) problems.push('Sticky changed shape: <CookieControls /> first, then the space-y-3 content div, nothing else');
    for (const rel of [VEP, SF]) {
      const bars = openTags(prepared(rel), 'div').filter((t) => t.includes('stickyBarClassName'));
      if (bars.length !== 1 || bars[0] !== PAGE_TAG) problems.push(`${rel}: bar tag is ${bars.join(' | ') || 'missing'}, expected ${PAGE_TAG}`);
    }
    const hooks = allSources().filter((rel) => prepared(rel).includes(HOOK)).sort();
    if (JSON.stringify(hooks) !== JSON.stringify([SF, VEP, SHARED].sort())) problems.push(`the pinned-bar hook is on ${JSON.stringify(hooks)}`);

    // No bottom offset class of any kind survives under app/ or components/ (marketplace excluded).
    for (const rel of allSources()) for (const t of rawTokens(prepared(rel))) if (OFFSETS.includes(t)) problems.push(`${rel}: ${t}`);

    // The safe area lives on the bar root only: no call site spells it, so no inner wrapper can hold it.
    for (const rel of [SHARED, VEP, SF]) if (prepared(rel).includes('safe-area-inset')) problems.push(`${rel}: spells the safe area (it belongs to the recipe alone)`);

    expect(problems).toEqual([]);
  });

  it('the three bars follow their scroller in the frame column and nothing positions them from the bottom', () => {
    const problems: string[] = [];

    // Planted first: a bar before its scroller, a wrapper in between, a sibling after or between.
    const page = (inner: string) => `<PhoneViewport a="b">\n  ${inner}\n</PhoneViewport>`;
    const scroller = `<div className="${SCROLLER} px-4"><p>x</p></div>`;
    const bar = `${PAGE_TAG}<a /></div>`;
    expect(pageOrderProblems('good', page(`${scroller}\n  ${bar}`), 'div')).toEqual([]);
    expect(pageOrderProblems('bar first', page(`${bar}\n  ${scroller}`), 'div')).not.toEqual([]);
    expect(pageOrderProblems('wrapped', page(`${scroller}\n  <div className="relative">${bar}</div>`), 'div')).not.toEqual([]);
    expect(pageOrderProblems('sibling after', page(`${scroller}\n  ${bar}\n  <p>tail</p>`), 'div')).not.toEqual([]);
    expect(pageOrderProblems('sibling between', page(`${scroller}\n  <p>gap</p>\n  ${bar}`), 'div')).not.toEqual([]);
    expect(stepOrderProblems('x', '<ScreenShell>a</ScreenShell>\n<Sticky>b</Sticky>')).toEqual([]);
    expect(stepOrderProblems('x', '<Sticky>b</Sticky>\n<ScreenShell>a</ScreenShell>')).not.toEqual([]);
    expect(stepOrderProblems('x', '<ScreenShell>a</ScreenShell><div /><Sticky>b</Sticky>')).not.toEqual([]);

    // The real surfaces: the flow frame as rendered, the three step files, the two pages.
    problems.push(...flowFrameProblems());
    for (const rel of STEPS) problems.push(...stepOrderProblems(rel, prepared(rel)));
    problems.push(...pageOrderProblems(VEP, prepared(VEP), 'div'));
    problems.push(...pageOrderProblems(SF, prepared(SF), 'section'));
    for (const rel of [SHARED, VEP, SF]) for (const t of rawTokens(prepared(rel))) if (OFFSETS.includes(t)) problems.push(`${rel}: ${t}`);
    expect(problems).toEqual([]);
  });

  it('the safe area is padded inside the bar and compiles to max(1rem, env(safe-area-inset-bottom))', async () => {
    const problems: string[] = [];
    // Tailwind escapes the comma in the class name and prints the value with a space after it, so the
    // rule is found by its declaration and compared without whitespace (decls() cannot find it).
    const padding = async (cls: string) => {
      const { rules } = await compileWith(config, [cls]);
      return rules.flatMap((r) => r.decls).filter((d) => d.startsWith('padding-bottom:')).map((d) => d.replace(/\s+/g, ''));
    };
    const want = 'padding-bottom:max(1rem,env(safe-area-inset-bottom))';

    // Planted first: env() without the floor, a fixed 16px and a lower floor must not satisfy the compare.
    expect(await padding(SAFE_PAD)).toEqual([want]);
    expect(await padding('pb-[env(safe-area-inset-bottom)]')).not.toEqual([want]);
    expect(await padding('pb-4')).not.toEqual([want]);
    expect(await padding('pb-[max(0.5rem,env(safe-area-inset-bottom))]')).not.toEqual([want]);

    if (!tokensOf(tokens.stickyBarClassName).includes(SAFE_PAD)) problems.push('the recipe does not carry the safe-area padding');
    // The root owns it: no call site and no inner wrapper repeats the inset.
    for (const rel of [SHARED, VEP, SF]) if (prepared(rel).includes('safe-area-inset')) problems.push(`${rel}: a safe-area inset outside the recipe`);
    // viewport-fit cover makes env() real on iOS and in in-app browsers; nothing to add there.
    if (!/viewportFit:\s*['"]cover['"]/.test(prepared(LAYOUT))) problems.push('app/layout.tsx lost viewportFit: cover');
    expect(problems).toEqual([]);
  });

  it("each bar surface's scroller ends in one small clearance constant, not a footprint guess", () => {
    const problems: string[] = [];

    // Planted first: a guess left in place, a constant outside the band, one that differs by surface.
    expect(clearanceProblems('x', 'pb-5')).toEqual([]);
    for (const bad of ['pb-48', 'pb-52', 'pb-64', 'pb-3', 'pb-8', 'pb-7']) expect(clearanceProblems('x', bad), bad).not.toEqual([]);
    expect(clearanceProblems('x', undefined)).not.toEqual([]);
    expect(storefrontClearance("className={`a ${hasPhone ? 'pb-48' : 'pb-8'} b`}")).toBe('pb-48');
    expect(vehicleClearance('<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-52 pt-1 lg:pb-20">')).toBe('pb-52');
    expect(flowClearance("className={`x ${stickySafe ? 'pb-64' : 'pb-20'}`}")).toBe('pb-64');

    const shell = sliceFunction(prepared(SHARED), 'ScreenShell');
    const vep = scrollerTag(VEP, 'div');
    const sf = scrollerTag(SF, 'section');
    const found = { flow: flowClearance(shell), vehicle: vehicleClearance(vep), storefront: storefrontClearance(sf) };
    for (const [site, value] of Object.entries(found)) problems.push(...clearanceProblems(site, value));
    if (new Set(Object.values(found)).size > 1) problems.push(`the clearance differs by surface: ${JSON.stringify(found)}`);
    // None of the footprint guesses survives in a scroller's class string.
    for (const [rel, text] of [[SHARED, shell], [VEP, vep], [SF, sf]] as const) for (const g of GUESSES) if (rawTokens(text).includes(g)) problems.push(`${rel}: ${g} remains`);
    // The no-bar branches are not bar surfaces and keep their own padding.
    if (!/\$\{stickySafe \? 'pb-\d+' : 'pb-20'\}/.test(shell)) problems.push('ScreenShell lost its pb-20 branch');
    if (!sf.includes("'pb-8'")) problems.push('the no-phone storefront lost pb-8');
    // The scroller stays a scroller (tests/chrome/chrome.frame.test.tsx requires the same contiguous run).
    for (const [rel, text] of [[VEP, vep], [SF, sf]] as const) if (!text.includes(SCROLLER)) problems.push(`${rel}: the run ${SCROLLER} is not contiguous`);
    expect(problems).toEqual([]);
  });

  it('desktop classes and lg:hidden survive byte for byte', () => {
    const problems: string[] = [];

    // Planted first: a changed lg token, a changed phone token beyond the padding, a dropped lg:hidden.
    expect(blank(WANT_VEP.replace('«pb»', 'pb-52'))).toBe(WANT_VEP);
    expect(blank(WANT_VEP.replace('«pb»', 'pb-5'))).toBe(WANT_VEP);
    expect(blank(WANT_VEP.replace('lg:px-8', 'lg:px-6'))).not.toBe(WANT_VEP);
    expect(blank(WANT_VEP.replace('pt-1', 'pt-2'))).not.toBe(WANT_VEP);
    expect(blank(WANT_SF.replace("'«pb»'", "'pb-48'"))).toBe(WANT_SF);
    expect(blank(WANT_SF.replace("'«pb»'", "'pb-5'"))).toBe(WANT_SF);
    expect(blank(WANT_SF.replace('lg:pb-20', 'lg:pb-24'))).not.toBe(WANT_SF);
    expect(openTags('<div className={`${stickyBarClassName}`}>', 'div')[0].includes('lg:hidden')).toBe(false);

    // The two scrollers: only the one phone bottom-padding token may differ from main.
    if (blank(classOfTag(scrollerTag(VEP, 'div'))) !== WANT_VEP) problems.push(`vehicle scroller: ${blank(classOfTag(scrollerTag(VEP, 'div')))}`);
    if (blank(classOfTag(scrollerTag(SF, 'section'))) !== WANT_SF) problems.push(`storefront scroller: ${blank(classOfTag(scrollerTag(SF, 'section')))}`);

    // Every lg: token on the two pages, in source order (the scrollers, both lg:grid wrappers, both
    // asides, the lg:hidden bars, every other desktop class), plus the literals the spec names.
    if (JSON.stringify(lgTokens(VEP)) !== JSON.stringify(LG_VEP)) problems.push(`vehicle page lg tokens: ${JSON.stringify(lgTokens(VEP))}`);
    if (JSON.stringify(lgTokens(SF)) !== JSON.stringify(LG_SF)) problems.push(`storefront lg tokens: ${JSON.stringify(lgTokens(SF))}`);
    for (const [rel, grid] of [[VEP, 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-12'], [SF, 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-12']] as const) if (!prepared(rel).includes(`className="${grid}"`)) problems.push(`${rel}: the lg:grid wrapper changed`);
    if (!prepared(VEP).includes('<aside className={`hidden lg:block ${stickyBelowBarClassName}`}>')) problems.push('vehicle aside changed');
    if (!prepared(SF).includes('<aside className={`scroll-quiet hidden lg:-mx-1 lg:-my-1 lg:block lg:space-y-4 lg:px-1 lg:py-1 ${stickyBelowBarClassName}`}>')) problems.push('storefront aside changed');
    // MP-24's recipe, byte for byte.
    if (tokens.stickyBelowBarClassName !== 'lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]') problems.push(`stickyBelowBarClassName: ${tokens.stickyBelowBarClassName}`);
    // The vehicle and storefront bars stay hidden from lg (the hook is not needed to see this).
    for (const rel of [VEP, SF]) {
      const bars = openTags(prepared(rel), 'div').filter((t) => t.includes('stickyBarClassName'));
      if (bars.length !== 1 || !bars[0].includes('lg:hidden')) problems.push(`${rel}: the page bar lost lg:hidden`);
    }
    expect(problems).toEqual([]);
  });

  it('Sticky is the one bar visible at lg and carries no bottom offset at any breakpoint', () => {
    const problems: string[] = [];
    // Planted first: the old root, a hidden-from-lg root, a breakpoint offset.
    const rootProblems = (root: string) => rawTokens(root).filter((t) => /(^|:)(sm:|md:|lg:|xl:|2xl:)/.test(t) || t === 'hidden' || /(^|:)-?bottom-/.test(t));
    expect(rootProblems(FLOW_TAG)).toEqual([]);
    expect(rootProblems('<div className={`${stickyBarClassName} bottom-4 md:bottom-5`}>')).not.toEqual([]);
    expect(rootProblems(PAGE_TAG)).not.toEqual([]);
    expect(rootProblems('<div className={`${stickyBarClassName} md:hidden`}>')).not.toEqual([]);

    // No breakpoint token on the recipe (so none hides it and none offsets it), and Sticky adds none.
    for (const t of tokensOf(tokens.stickyBarClassName)) if (t.includes(':')) problems.push(`recipe: a variant token ${t}`);
    const sticky = sliceFunction(prepared(SHARED), 'Sticky');
    const root = openTags(sticky, 'div')[0] ?? '';
    if (root !== FLOW_TAG) problems.push(`Sticky root: ${root}`);
    for (const t of rootProblems(root)) problems.push(`Sticky root carries ${t}`);
    for (const t of rawTokens(sticky)) if (OFFSETS.includes(t)) problems.push(`Sticky: ${t}`);
    // Every flow step mounts the same Sticky: none wraps it in a breakpoint-hidden element.
    for (const rel of STEPS) if (/(?:lg|md):hidden[^<]*>\s*<Sticky/.test(prepared(rel))) problems.push(`${rel}: Sticky sits inside a hidden-from-breakpoint element`);
    expect(problems).toEqual([]);
  });
});
