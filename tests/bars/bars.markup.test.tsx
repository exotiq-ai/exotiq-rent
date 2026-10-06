// MP-28 markup test (AC5): the bar's height is whatever it holds, and nothing sizes the scroller from
// it. The real `Sticky` is rendered with react-dom/server holding each of the contents the bar can
// hold (the cookie row, the Dates running total, a request-error banner) and the opening tag, its
// attributes and its class string are compared across all of them. The scroller side is a source
// check: `ScreenShell` and the two page scrollers read no prop or condition derived from the bar.
// The measured half (ground between 16 and 24px in every bar state) is the verify lane's probe.
//
// Red on the base by design: the bar is found by its `data-chrome="pinned-bar"` hook, which the base
// does not carry. Everything else here is true on the base as well and must stay true.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const cookie = vi.hoisted(() => ({ renders: false }));
vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
// The cookie row is the one switch under test: present (the production host) or absent (the local default).
vi.mock('@/components/analytics/CookieControls', () => ({
  CookieControls: () => (cookie.renders ? <div data-cookie-controls="row" className="relative -mt-1 mb-1.5">Privacy preferences</div> : null),
}));

import { PrimaryButton } from '@/components/drive-exotiq/BookingChrome';
import { RunningTotalCard, ScreenShell, Sticky } from '@/components/drive-exotiq/flow/shared';
import { stripComments } from '../design/lib/scan.mjs';
import { type El, byAttr, classes, elements, parseHtml } from '../fees/fixtures';
import { openTags, sliceFunction } from '../restraint/restraintScan';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const prepared = (rel: string) => stripComments(readFileSync(join(REPO, rel), 'utf8'));
const SHARED = 'components/drive-exotiq/flow/shared.tsx';
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const SF = 'app/[operatorSlug]/page.tsx';

/** What the bar can hold, as the three flow steps and the two pages put in it. */
const STATES: { name: string; cookie: boolean; content: ReactNode }[] = [
  { name: 'button only', cookie: false, content: <PrimaryButton>Continue</PrimaryButton> },
  { name: 'cookie row and button', cookie: true, content: <PrimaryButton>Continue</PrimaryButton> },
  { name: 'running total and button', cookie: false, content: <><RunningTotalCard label="Oct 12–15 · 3 days" detail="$1,199/day × 3" amountCents={359700} /><PrimaryButton>Continue</PrimaryButton></> },
  { name: 'cookie row, running total and button', cookie: true, content: <><RunningTotalCard label="Oct 12–15 · 3 days" detail="$1,199/day × 3" amountCents={359700} /><PrimaryButton>Continue</PrimaryButton></> },
  { name: 'error banner and button', cookie: false, content: <><p className="rounded-xl border border-danger/45 bg-danger/10 p-3 text-center text-body-sm leading-5 text-ink">We could not send the request. Try again.</p><PrimaryButton>Request this booking</PrimaryButton></> },
  { name: 'cookie row, error banner and button', cookie: true, content: <><p className="rounded-xl border border-danger/45 bg-danger/10 p-3 text-center text-body-sm leading-5 text-ink">We could not send the request. Try again.</p><PrimaryButton>Request this booking</PrimaryButton></> },
];

type Shape = { open: string; attrs: string[]; cls: string; tag: string };
/** The bar's shape in one render: its opening tag, attribute names and class string. Null when there is no hook. */
function shapeOf(html: string): Shape | null {
  const bar = byAttr(parseHtml(html), 'data-chrome', 'pinned-bar')[0];
  return bar ? { open: html.slice(bar.start, bar.innerStart), attrs: Object.keys(bar.attrs).sort(), cls: bar.attrs.class ?? '', tag: bar.tag } : null;
}
const renderBar = (s: { cookie: boolean; content: ReactNode }) => {
  cookie.renders = s.cookie;
  return renderToStaticMarkup(<Sticky>{s.content}</Sticky>);
};

/** What is wrong with a set of bar shapes: it must have one shape, no sizing, and only a class and the hook. */
function shapeProblems(shapes: (Shape | null)[]): string[] {
  const p: string[] = [];
  if (shapes.some((s) => s === null)) return ['a bar render has no data-chrome="pinned-bar" element'];
  const all = shapes as Shape[];
  if (new Set(all.map((s) => s.open)).size !== 1) p.push(`the opening tag differs between states: ${JSON.stringify(Array.from(new Set(all.map((s) => s.open))))}`);
  for (const s of all) {
    if (JSON.stringify(s.attrs) !== JSON.stringify(['class', 'data-chrome'])) p.push(`attributes are ${JSON.stringify(s.attrs)}, expected only class and data-chrome (no style, no height prop)`);
    for (const c of s.cls.split(/\s+/)) if (/(^|:)(min-|max-)?h-/.test(c)) p.push(`the bar is sized by ${c}`);
    if (s.open.includes('style=')) p.push('the bar carries an inline style');
  }
  return p;
}

describe('MP-28 bar states (AC5)', () => {
  it('Sticky keeps one shape whatever it holds and sizes nothing from it', () => {
    const problems: string[] = [];

    // Planted: the checker must catch a bar that is resized by its content, or carries a style.
    const good: Shape = { open: '<div data-chrome="pinned-bar" class="relative z-10">', attrs: ['class', 'data-chrome'], cls: 'relative z-10', tag: 'div' };
    expect(shapeProblems([good, good])).toEqual([]);
    expect(shapeProblems([good, { ...good, open: '<div data-chrome="pinned-bar" class="relative z-10 min-h-32">', cls: 'relative z-10 min-h-32' }])).not.toEqual([]);
    expect(shapeProblems([good, { ...good, open: '<div data-chrome="pinned-bar" class="relative z-10 h-24">', cls: 'relative z-10 h-24' }])).not.toEqual([]);
    expect(shapeProblems([good, { ...good, attrs: ['class', 'data-chrome', 'style'], open: '<div data-chrome="pinned-bar" class="relative z-10" style="height:96px">' }])).not.toEqual([]);
    expect(shapeProblems([good, null])).not.toEqual([]);

    // The real bar: one shape across all six contents.
    const shapes = STATES.map((s) => shapeOf(renderBar(s)));
    problems.push(...shapeProblems(shapes));

    // Positive control: the harness really puts a cookie row, a running total and a banner in the bar.
    for (const s of STATES) {
      const root = parseHtml(renderBar(s));
      const bar = byAttr(root, 'data-chrome', 'pinned-bar')[0] ?? root;
      const first = bar.children.find((c): c is El => typeof c !== 'string');
      const row = elements(bar).some((e) => e.attrs['data-cookie-controls'] === 'row');
      if (row !== s.cookie) problems.push(`${s.name}: cookie row ${row ? 'rendered' : 'missing'}`);
      if (s.cookie && first?.attrs['data-cookie-controls'] !== 'row') problems.push(`${s.name}: the cookie row is not the bar's first child`);
      const content = bar.children.filter((c): c is El => typeof c !== 'string').pop();
      if (!content || !classes(content).includes('space-y-3')) problems.push(`${s.name}: the content div is not the bar's last child`);
      const hasTotal = elements(bar).some((e) => e.tag === 'div' && classes(e).includes('border-t') && classes(e).includes('pt-3') && e !== bar);
      if (s.name.includes('running total') !== hasTotal) problems.push(`${s.name}: running total ${hasTotal ? 'rendered' : 'missing'}`);
      if (s.name.includes('error banner') !== elements(bar).some((e) => e.tag === 'p' && classes(e).includes('border-danger/45'))) problems.push(`${s.name}: banner state wrong`);
    }

    // The scroller sizes nothing from the bar: ScreenShell takes only its children and the existing
    // stickySafe switch, and its class string has no other condition. Same for the two page scrollers.
    const shell = sliceFunction(prepared(SHARED), 'ScreenShell');
    if (!/^(export )?function ScreenShell\(\{ children, stickySafe = true \}: \{ children: ReactNode; stickySafe\?: boolean \}\)/.test(shell)) problems.push(`ScreenShell takes more than children and stickySafe: ${shell.slice(0, 160)}`);
    if ((shell.match(/\$\{/g) ?? []).length !== 1) problems.push('ScreenShell class string has a condition other than stickySafe');
    const vep = openTags(prepared(VEP), 'div').find((t) => t.includes('min-h-0 flex-1 overflow-y-auto')) ?? '';
    if (vep.includes('${')) problems.push('the vehicle scroller class string has a condition');
    const sf = openTags(prepared(SF), 'section').find((t) => t.includes('min-h-0 flex-1 overflow-y-auto')) ?? '';
    if ((sf.match(/\$\{/g) ?? []).length !== 1 || !sf.includes('${hasPhone ?')) problems.push('the storefront scroller class string has a condition other than hasPhone');

    // The scroller's markup is the same whatever the bar holds: render it twice with different children.
    const rootOf = (html: string) => html.slice(0, html.indexOf('>') + 1);
    const a = rootOf(renderToStaticMarkup(<ScreenShell><p>short</p></ScreenShell>));
    const b = rootOf(renderToStaticMarkup(<ScreenShell><p>a very long step with a running total beneath it</p></ScreenShell>));
    if (a !== b) problems.push('ScreenShell root differs with its children');

    expect(problems).toEqual([]);
  });
});
