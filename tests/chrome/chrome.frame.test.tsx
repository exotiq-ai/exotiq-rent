// MP-17 frame tests: the booking frame (`PhoneViewport` / `BookingChrome`) and `PageFrame`
// (AC1, AC2, AC3, AC7, AC10, AC14, AC15). Renders go through react-dom/server; the tests find the
// chrome by its `data-chrome` hooks, never by colour classes, so later restyles do not churn them.
//
// AC14 is a golden comparison: the panel frame (header row, frame and wrapper classes, children
// slot, the lg rail) rendered at the branch base efff2bb, with only the step indicator cut out,
// must stay byte-identical after this ticket. The golden is recorded from the base BEFORE the
// first source edit; the provenance check below proves the order from git history.
//
// Recording (base only): MP17_RECORD_GOLDEN=1 npx vitest run tests/chrome/chrome.frame.test.tsx
// The recorder never overwrites the golden and refuses to run once any non-test path has changed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { BookingChrome, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { FLOW_STEPS } from '@/components/drive-exotiq/flow/steps';
import { stripComments } from '../design/lib/scan.mjs';
import { type El, byAttr, classes, elements, hasClass, norm, outer, parseHtml, textOf } from '../fees/fixtures';
import { goldCount, openTags } from '../restraint/restraintScan';

afterEach(() => {
  vi.unstubAllEnvs();
});

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const GOLDEN = fileURLToPath(new URL('./golden/panel-frame.base.json', import.meta.url));
const GOLDEN_REL = 'tests/chrome/golden/panel-frame.base.json';
/** The branch base: main after MP-15, MP-16 and MP-26 merged. */
const BASE_SHA = 'efff2bbce843ab29be5f7a07ddaf4bf0bfe57fb3';
const git = (...args: string[]): string => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
const lines = (out: string) => out.split('\n').map((l) => l.trim()).filter(Boolean);
/** What "a source edit" means for the recording rule: anything outside tests/. */
const isSource = (p: string) => !p.startsWith('tests/');
const noop = () => {};

// Props that change in this ticket go through a loose type, so the base and the change both compile.
const Frame = PhoneViewport as unknown as ComponentType<Record<string, unknown>>;
const Chrome = BookingChrome as unknown as ComponentType<Record<string, unknown>>;
const renderFrame = (props: Record<string, unknown>, children: ReactNode) =>
  renderToStaticMarkup(createElement(Frame, { layout: 'panel', className: 'font-[var(--font-drive-inter)]', ...props }, children));
/** The storefront / vehicle detail frame as those pages render it after this ticket: no step. */
const desktopNav = <a href="/browse">Browse the fleet</a>;
const renderPage = (closeHref = '/exotiq') =>
  renderToStaticMarkup(createElement(Frame, { layout: 'page', className: 'font-[var(--font-drive-inter)]', closeHref, desktopNav }, <p data-probe>child</p>));
const renderChrome = (step: number) => renderToStaticMarkup(createElement(Chrome, { step, closeHref: '/exotiq' }, <p data-probe>child</p>));

type PageFrameType = ComponentType<{ homeHref: string; children?: ReactNode }>;
/** PageFrame is new in this ticket: loaded dynamically so a missing module fails one test, not the file. */
async function pageFrame(): Promise<PageFrameType | null> {
  try {
    return (await import('@/components/browse/PageFrame')).PageFrame as PageFrameType;
  } catch {
    return null;
  }
}
const renderPageFrame = (PageFrame: PageFrameType, homeHref = '/exotiq') => renderToStaticMarkup(<PageFrame homeHref={homeHref}><p data-probe>child</p></PageFrame>);

const SRC = (rel: string) => stripComments(readFileSync(join(REPO, rel), 'utf8'));
const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
const tokensOf = (el: El | undefined): string[] => (el ? classes(el) : []);
/** The accessible name of a link: its aria-label, else its text plus the alt of the images in it. */
const accessibleName = (a: El): string => a.attrs['aria-label'] ?? norm(`${textOf(a)} ${elements(a).filter((e) => e.tag === 'img').map((i) => i.attrs.alt ?? '').join(' ')}`);

/** Wizard chrome present anywhere in a render (AC1): presence in the DOM, not visibility. */
export function wizardChrome(html: string): string[] {
  const root = parseHtml(html);
  const all = elements(root);
  const found: string[] = [];
  if (all.some((e) => e.attrs['aria-label'] === 'Back' || ((e.tag === 'button' || e.tag === 'a') && norm(textOf(e)) === 'Back'))) found.push('a Back control');
  if (all.some((e) => e.attrs['aria-label'] === 'Close booking flow')) found.push('a Close booking flow link');
  if (byAttr(root, 'data-chrome', 'progress').length) found.push('a progress element');
  if (all.some((e) => classes(e).includes('h-[3px]'))) found.push('a step bar');
  const counter = /\b0?\d\s*\/\s*0?\d\b/.exec(norm(textOf(root)));
  if (counter) found.push(`step counter text "${counter[0]}"`);
  return found;
}

/** The flow progress of a render: the nav, its items, and each item's label element. */
function progressOf(html: string): { nav: El; items: El[]; labels: (El | undefined)[] } | null {
  const navs = byAttr(parseHtml(html), 'data-chrome', 'progress');
  if (navs.length !== 1) return null;
  const nav = navs[0];
  const items = elements(nav).filter((e) => e.tag === 'li');
  const labels = items.map((li) => elements(li).find((e) => e !== li && e.tag === 'span' && norm(textOf(e)) !== ''));
  return { nav, items, labels };
}
const LABELS = ['Dates', 'Driver', 'Review'];

/** AC14 cases: what the base was rendered with, and what the same caller passes after this ticket. */
const CASES: Record<string, { base: Record<string, unknown>; now: Record<string, unknown>; stepped: boolean }> = {
  'step2-plain': { base: { step: 2, closeHref: '/exotiq' }, now: { step: 2, closeHref: '/exotiq' }, stepped: true },
  'step3-back-rail': { base: { step: 3, onBack: noop, rail: <p data-probe>rail</p> }, now: { step: 3, onBack: noop, rail: <p data-probe>rail</p> }, stepped: true },
  // The full confirmation passed step={6} at the base; after this ticket it passes no step.
  'confirmation-full': { base: { step: 6, closeHref: '/exotiq' }, now: { closeHref: '/exotiq' }, stepped: false },
  // The restricted confirmation: step={6} and no closeHref at the base; nothing after.
  'confirmation-restricted': { base: { step: 6 }, now: {}, stepped: false },
};
const child = <p data-probe>child</p>;

/**
 * The panel frame split at the step indicator: `cut` is everything between the end of the header
 * row and the start of the children wrapper (the strip at the base, the progress after), and
 * `without` is the whole render with that range removed. No whitespace normalisation.
 */
export function splitProgress(html: string): { without: string; cut: string } {
  const root = parseHtml(html);
  const row = elements(root).find((e) => e.tag === 'div' && hasClass(e, 'grid', 'flex-shrink-0', 'grid-cols-[40px_1fr_40px]'));
  const wrap = elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === 'flex min-h-0 flex-1 flex-col');
  if (!row || !wrap) throw new Error('panel header row or children wrapper not found');
  if (wrap.start < row.end) throw new Error('children wrapper precedes the header row');
  return { without: html.slice(0, row.end) + html.slice(wrap.start), cut: html.slice(row.end, wrap.start) };
}

type Golden = { baseSha: string; recordedAt: string; recordedOn: string; cases: Record<string, { without: string }>; cutAtBase: Record<string, string> };

describe('MP-17 AC14 golden (recorded from the base)', () => {
  it.skipIf(!process.env.MP17_RECORD_GOLDEN)('records the panel-frame golden before any source edit (MP17_RECORD_GOLDEN, never overwrites)', () => {
    const committed = lines(git('diff', '--name-only', BASE_SHA, 'HEAD')).filter(isSource);
    const dirty = lines(git('status', '--porcelain')).map((l) => l.slice(3)).filter(isSource);
    expect([...committed, ...dirty], 'the golden must be recorded from the unchanged base').toEqual([]);
    expect(existsSync(GOLDEN), 'the golden exists already; it is never overwritten').toBe(false);
    const golden: Golden = { baseSha: BASE_SHA, recordedAt: git('rev-parse', 'HEAD'), recordedOn: new Date().toISOString(), cases: {}, cutAtBase: {} };
    for (const [name, c] of Object.entries(CASES)) {
      const { without, cut } = splitProgress(renderFrame(c.base, child));
      golden.cases[name] = { without };
      golden.cutAtBase[name] = cut;
    }
    mkdirSync(join(GOLDEN, '..'), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(golden, null, 1)}\n`);
  });
});

describe('MP-17 frame', () => {
  it('flow header row and frame are byte-identical outside the progress', () => {
    const problems: string[] = [];
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Golden;

    // Provenance: recorded from the base, and committed before the first source edit since it.
    if (golden.baseSha !== BASE_SHA) problems.push(`golden base ${golden.baseSha} is not ${BASE_SHA}`);
    try { git('merge-base', '--is-ancestor', BASE_SHA, 'HEAD'); } catch { problems.push('the base is not an ancestor of HEAD'); }
    const goldenCommit = lines(git('log', '--diff-filter=A', '--format=%H', '--', GOLDEN_REL)).pop() ?? '';
    if (!goldenCommit) problems.push('the golden is not committed');
    const firstSource = lines(git('rev-list', '--reverse', `${BASE_SHA}..HEAD`)).find((sha) => lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', sha)).some(isSource));
    if (goldenCommit && firstSource) {
      if (goldenCommit === firstSource) problems.push('the golden landed in the same commit as a source edit');
      else try { git('merge-base', '--is-ancestor', goldenCommit, firstSource); } catch { problems.push(`golden commit ${goldenCommit.slice(0, 7)} is not an ancestor of the first source commit ${firstSource.slice(0, 7)}`); }
    }

    // Re-render with today's props and compare byte for byte, naming where it moved.
    for (const [name, c] of Object.entries(CASES)) {
      const want = golden.cases[name]?.without;
      if (want === undefined) { problems.push(`${name}: no golden`); continue; }
      const { without, cut } = splitProgress(renderFrame(c.now, child));
      if (without !== want) {
        let i = 0;
        while (i < without.length && without[i] === want[i]) i++;
        problems.push(`${name}: differs at ${i}: base "…${want.slice(Math.max(0, i - 60), i + 60)}…" now "…${without.slice(Math.max(0, i - 60), i + 60)}…"`);
      }
      // Positive control: the cut is the indicator, so a stepped panel always has one to cut.
      if (c.stepped && cut.length === 0) problems.push(`${name}: nothing between the header row and the wrapper (the cut found no indicator)`);
    }

    // Planted: one class added to the header row is caught by the same comparison.
    const planted = golden.cases['step2-plain'].without.replace('grid flex-shrink-0', 'grid gap-1 flex-shrink-0');
    expect(planted).not.toBe(golden.cases['step2-plain'].without);

    expect(problems).toEqual([]);
  });

  it('page layout renders no back, close or step chrome at any width', async () => {
    const problems: string[] = [];
    // Storefront, its empty state and the vehicle detail all render this frame with no step.
    problems.push(...wizardChrome(renderPage()).map((p) => `PhoneViewport layout="page": ${p}`));
    const PageFrame = await pageFrame();
    if (!PageFrame) problems.push('components/browse/PageFrame.tsx does not load');
    else problems.push(...wizardChrome(renderPageFrame(PageFrame)).map((p) => `PageFrame: ${p}`));

    // Planted: hiding chrome below a breakpoint is still chrome; a numbered strip is caught by its text.
    expect(wizardChrome('<div class="lg:hidden"><button class="hidden" aria-label="Back"></button></div>')).toEqual(['a Back control']);
    expect(wizardChrome('<div><b>01</b><span> / 06</span></div>')).toEqual(['step counter text "01 / 06"']);
    expect(wizardChrome('<div><span class="h-[3px] w-8"></span></div>')).toEqual(['a step bar']);
    expect(wizardChrome('<main><a href="/exotiq"><img alt="Drive Exotiq"/></a><p>3 cars</p></main>')).toEqual([]);

    expect(problems).toEqual([]);
  });

  it('page layout below lg is a lockup-only bar linking home', async () => {
    // Browse on and renter capture on: the desktop SiteBar then carries the saved link too.
    vi.stubEnv('NEXT_PUBLIC_MARKETPLACE_BROWSE', 'on');
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
    const problems: string[] = [];
    for (const href of ['/exotiq', '/acme']) {
      const root = parseHtml(renderPage(href));
      const bars = byAttr(root, 'data-chrome', 'mobile-bar');
      if (bars.length !== 1) problems.push(`${href}: ${bars.length} mobile bars, expected 1`);
      for (const bar of bars) {
        const links = elements(bar).filter((e) => e.tag === 'a');
        if (links.length !== 1) problems.push(`${href}: ${links.length} links in the mobile bar, expected 1`);
        for (const a of links) {
          if (a.attrs.href !== href) problems.push(`${href}: the bar links to ${a.attrs.href}`);
          if (accessibleName(a) !== 'Drive Exotiq') problems.push(`${href}: the bar link is named "${accessibleName(a)}"`);
        }
        const buttons = elements(bar).filter((e) => e.tag === 'button');
        if (buttons.length) problems.push(`${href}: ${buttons.length} button(s) in the mobile bar`);
        if (!tokensOf(bar).includes('lg:hidden')) problems.push(`${href}: the mobile bar is not lg:hidden`);
      }

      // From lg up the existing SiteBar is unchanged: hidden below lg, block from lg, home link, nav, saved link.
      const headers = elements(root).filter((e) => e.tag === 'header');
      if (headers.length !== 1) { problems.push(`${href}: ${headers.length} site bars`); continue; }
      const header = headers[0];
      if (!hasClass(header, 'hidden', 'lg:block')) problems.push(`${href}: desktop SiteBar lost "hidden lg:block" (${tokensOf(header).join(' ')})`);
      const headerLinks = elements(header).filter((e) => e.tag === 'a').map((a) => a.attrs.href);
      for (const want of [href, '/browse', '/saved']) if (!headerLinks.includes(want)) problems.push(`${href}: desktop SiteBar has no link to ${want} (${headerLinks.join(', ')})`);
    }

    // PageFrame: its SiteBar points at homeHref and nothing gates its visibility.
    const PageFrame = await pageFrame();
    if (!PageFrame) problems.push('components/browse/PageFrame.tsx does not load');
    else for (const href of ['/exotiq', '/acme']) {
      const root = parseHtml(renderPageFrame(PageFrame, href));
      const headers = elements(root).filter((e) => e.tag === 'header');
      if (headers.length !== 1) { problems.push(`PageFrame ${href}: ${headers.length} site bars`); continue; }
      for (let n: El | null = headers[0]; n && n !== root; n = n.parent) {
        if (tokensOf(n).some((t) => t === 'hidden' || /(^|:)hidden$/.test(t))) problems.push(`PageFrame ${href}: <${n.tag}> around the SiteBar carries ${tokensOf(n).filter((t) => /hidden$/.test(t)).join(' ')}`);
      }
      const home = elements(headers[0]).filter((e) => e.tag === 'a');
      if (home[0]?.attrs.href !== href) problems.push(`PageFrame ${href}: SiteBar home link is ${home[0]?.attrs.href}`);
    }
    expect(problems).toEqual([]);
  });

  it('page layout keeps its phone cage, scroll wrapper, condense hook and desktop page classes', () => {
    const problems: string[] = [];
    const root = parseHtml(renderPage());
    const frames = elements(root).filter((e) => e.tag === 'div' && tokensOf(e).includes('max-w-[480px]'));
    if (frames.length !== 1) problems.push(`${frames.length} 480px frames, expected 1`);
    const frame = frames[0];
    const want = ['h-dvh', 'max-w-[480px]', 'overflow-hidden', 'flex-col', 'bg-panel', 'min-[481px]:border-x', 'min-[481px]:border-line', 'lg:h-auto', 'lg:max-w-[1200px]', 'lg:overflow-visible', 'lg:border-0'];
    for (const t of want) if (!tokensOf(frame).includes(t)) problems.push(`frame lost ${t}`);
    for (const t of tokensOf(frame)) if (/(^|:)shadow/.test(t)) problems.push(`frame carries ${t}`);
    // The children wrapper scrolls internally: a direct child of the frame.
    const wrap = frame?.children.find((c): c is El => typeof c !== 'string' && classes(c).join(' ') === 'flex min-h-0 flex-1 flex-col');
    if (!wrap) problems.push('the children wrapper "flex min-h-0 flex-1 flex-col" is not a direct child of the frame');
    else if (!elements(wrap).some((e) => 'data-probe' in e.attrs)) problems.push('the children are not inside the wrapper');
    // The bar renders uncondensed at rest.
    const bar = byAttr(root, 'data-chrome', 'mobile-bar')[0];
    if (!bar) problems.push('no mobile bar');
    else {
      for (const t of ['pb-1', 'pt-[calc(env(safe-area-inset-top)+10px)]']) if (!tokensOf(bar).includes(t)) problems.push(`the bar at rest lost ${t}`);
      for (const t of ['pb-0.5', 'pt-[calc(env(safe-area-inset-top)+4px)]']) if (tokensOf(bar).includes(t)) problems.push(`the bar renders condensed at rest (${t})`);
    }
    const header = elements(root).find((e) => e.tag === 'header');
    if (!header || !hasClass(header, 'hidden', 'lg:block')) problems.push('desktop SiteBar lost "hidden lg:block"');

    // The condense hook (source): a capture-phase scroll listener, the 40px threshold, and the
    // bar's own padding switching between the two literals on that state.
    const src = SRC(CHROME);
    if (!/addEventListener\(\s*'scroll'\s*,\s*\w+\s*,\s*\{[^}]*capture:\s*true/.test(src)) problems.push('no capture-phase scroll listener');
    if (!/scrollTop\s*>\s*40\b/.test(src)) problems.push('the 40px threshold is gone');
    const barTag = openTags(src, 'div').find((t) => t.includes('data-chrome="mobile-bar"')) ?? '';
    if (!barTag.includes("condensed ? 'pb-0.5 pt-[calc(env(safe-area-inset-top)+4px)]' : 'pb-1 pt-[calc(env(safe-area-inset-top)+10px)]'")) problems.push(`the mobile bar does not condense on the scroll state: ${barTag || '(no mobile bar in source)'}`);

    // The pages still scroll inside the frame and pin their bottom bars (unchanged files, pinned).
    const storefront = SRC('app/[operatorSlug]/page.tsx');
    const vehicle = SRC('components/drive-exotiq/VehicleEntryPage.tsx');
    if (!openTags(storefront, 'section').some((t) => t.includes('min-h-0 flex-1 overflow-y-auto'))) problems.push('storefront no longer scrolls inside the frame');
    if (!openTags(vehicle, 'div').some((t) => t.includes('min-h-0 flex-1 overflow-y-auto'))) problems.push('vehicle page no longer scrolls inside the frame');
    for (const [label, text] of [['storefront', storefront], ['vehicle page', vehicle]] as const) if (!text.includes('stickyBarClassName')) problems.push(`${label} lost its pinned bar recipe`);

    expect(problems).toEqual([]);
  });

  it('flow progress names exactly Dates, Driver and Review and marks the current step', () => {
    const problems: string[] = [];
    for (const n of [1, 2, 3]) {
      const html = renderChrome(n);
      const p = progressOf(html);
      if (!p) { problems.push(`step=${n}: no single [data-chrome="progress"]`); continue; }
      const { nav, items, labels } = p;
      if (nav.tag !== 'nav' || nav.attrs['aria-label'] !== 'Booking progress') problems.push(`step=${n}: progress is <${nav.tag} aria-label="${nav.attrs['aria-label']}">`);
      const lists = elements(nav).filter((e) => e.tag === 'ol');
      if (lists.length !== 1 || items.some((li) => li.parent !== lists[0])) problems.push(`step=${n}: the items are not one ordered list`);
      const got = items.map((li) => norm(textOf(li)));
      if (JSON.stringify(got) !== JSON.stringify(LABELS)) problems.push(`step=${n}: items ${JSON.stringify(got)}`);
      if (labels.some((l) => !l)) problems.push(`step=${n}: an item has no label element`);
      items.forEach((li, i) => {
        const at = i + 1;
        const wantState = at < n ? 'done' : at === n ? 'current' : 'upcoming';
        if ((li.attrs['aria-current'] === 'step') !== (at === n)) problems.push(`step=${n}: item ${at} aria-current="${li.attrs['aria-current'] ?? ''}"`);
        if (at !== n && li.attrs['data-state'] !== wantState) problems.push(`step=${n}: item ${at} data-state="${li.attrs['data-state']}", expected ${wantState}`);
      });
      if (elements(parseHtml(html)).filter((e) => 'aria-current' in e.attrs).length !== 1) problems.push(`step=${n}: aria-current outside the current item`);
      const text = norm(textOf(nav));
      for (const word of ['Vehicle', 'Done', 'Pay']) if (new RegExp(`\\b${word}\\b`).test(text)) problems.push(`step=${n}: "${word}" in the progress`);
      if (JSON.stringify(got) !== JSON.stringify(FLOW_STEPS.map((s) => s.label))) problems.push(`step=${n}: the progress labels are not FLOW_STEPS (${JSON.stringify(got)})`);
      if (/\d/.test(text)) problems.push(`step=${n}: a numeral in the progress ("${text}")`);
      if (goldCount(outer(html, nav))) problems.push(`step=${n}: gold in the progress`);
    }
    // Out of range: no throw, three items, none current.
    for (const n of [0, 4, Number.NaN, -1]) {
      let html = '';
      try { html = renderChrome(n); } catch (e) { problems.push(`step=${n}: threw ${(e as Error).message}`); continue; }
      const p = progressOf(html);
      if (!p || p.items.length !== 3) problems.push(`step=${n}: progress with ${p?.items.length ?? 0} items, expected 3`);
      if (elements(parseHtml(html)).some((e) => 'aria-current' in e.attrs)) problems.push(`step=${n}: an item is marked current`);
      if (p && p.items.some((li) => li.attrs['data-state'] !== 'upcoming')) problems.push(`step=${n}: states ${p.items.map((li) => li.attrs['data-state']).join(',')}`);
    }
    expect(problems).toEqual([]);
  });

  it('panel layout without a step renders no progress, as the confirmation does', () => {
    const problems: string[] = [];
    for (const [label, props] of [['full', { closeHref: '/exotiq' }], ['restricted', {}]] as const) {
      const root = parseHtml(renderFrame(props, <p data-probe>child</p>));
      if (byAttr(root, 'data-chrome', 'progress').length) problems.push(`${label}: a progress element`);
      if (elements(root).some((e) => classes(e).includes('h-[3px]'))) problems.push(`${label}: a step bar`);
    }
    // Positive control: the same panel with a step does render the progress.
    if (byAttr(parseHtml(renderFrame({ step: 2, closeHref: '/exotiq' }, <p data-probe>child</p>)), 'data-chrome', 'progress').length !== 1) problems.push('panel with step=2: no progress (positive control)');
    // ConfirmationScreen passes no step in either branch.
    const tags = openTags(SRC('components/drive-exotiq/ConfirmationScreen.tsx'), 'PhoneViewport');
    if (tags.length !== 2) problems.push(`ConfirmationScreen: ${tags.length} PhoneViewport tags, expected 2 (full and restricted)`);
    for (const t of tags) if (/\bstep=/.test(t)) problems.push(`ConfirmationScreen: ${t}`);
    expect(problems).toEqual([]);
  });

  it('flow progress cannot overflow a 320px frame', () => {
    const problems: string[] = [];
    const FIXED = /^(?:[a-z0-9-]+:)*(?:min-w|w|max-w)-\[/;
    for (const n of [1, 2, 3]) {
      const p = progressOf(renderChrome(n));
      if (!p) { problems.push(`step=${n}: no progress`); continue; }
      const lists = elements(p.nav).filter((e) => e.tag === 'ol');
      for (const el of [p.nav, ...lists, ...p.items, ...p.labels.filter((l): l is El => !!l)]) {
        for (const t of tokensOf(el)) if (FIXED.test(t)) problems.push(`step=${n}: fixed width ${t} on <${el.tag}>`);
      }
      for (const el of elements(p.nav)) if (tokensOf(el).some((t) => /(^|:)whitespace-nowrap$/.test(t))) problems.push(`step=${n}: whitespace-nowrap on <${el.tag}>`);
      p.items.forEach((li, i) => {
        for (const t of ['min-w-0', 'flex-1']) if (!tokensOf(li).includes(t)) problems.push(`step=${n}: item ${i + 1} lacks ${t}`);
        const label = p.labels[i];
        for (const t of ['truncate', 'text-micro']) if (!tokensOf(label).includes(t)) problems.push(`step=${n}: label ${i + 1} lacks ${t}`);
      });
    }
    expect(problems).toEqual([]);
  });
});
