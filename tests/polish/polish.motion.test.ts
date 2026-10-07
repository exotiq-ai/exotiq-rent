// MP-25 AC4, AC5: every motion MP-25 adds stands down under reduced motion; a step enters with one short
// fade and rise while the chrome holds still. CSS and source scans plus react-dom/server. The measured
// halves (no animation over 0.01ms under emulated reduce, the chrome not moving, no replay on typing or
// on the Protect flip, fixed-capture mid-entry) are scripts/polish-probe.mjs's (evidence AC4, AC5).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));

import { ScreenShell } from '@/components/drive-exotiq/flow/shared';
import { stripComments } from '../design/lib/scan.mjs';
import { elements, parseHtml } from '../fees/fixtures';
import { literals, prepare, sliceFunction } from '../restraint/restraintScan';
import { CSS, DATES, DRIVER, FLOW, PAGER, REVIEW, SHARED, SITEBAR, allKeyframes, animations, baseCensus, fence, keyframes, loadPager, ms, read, sha, withoutFence } from './polishBase';

/** Motion problems in a polish fence: keyframes beyond transform and opacity, delays, repeats, fills, a raw hover. */
function fenceMotionProblems(f: string): string[] {
  const p: string[] = [];
  for (const k of allKeyframes(f)) if (k.props.some((x) => x !== 'transform' && x !== 'opacity')) p.push(`@keyframes ${k.name} animates ${k.props.join(', ')}`);
  for (const a of animations(f)) {
    if (a.times.length !== 1) p.push(`${a.selector}: ${a.times.length} time values (a delay escapes the reduced-motion block)`);
    if (/\b(infinite|forwards|backwards|both)\b/.test(a.value)) p.push(`${a.selector}: ${a.value} (repeat or fill)`);
  }
  if (/:hover/.test(f)) p.push('a :hover selector in the polish fence');
  return p;
}

describe('MP-25 motion', () => {
  it('every MP-25 motion stands down under reduced motion', async () => {
    const problems: string[] = [];
    // Planted first: a layout keyframe, a delay, a fill and a raw hover are each seen.
    for (const [what, css] of [
      ['a layout keyframe', '@keyframes x { from { height: 0; } to { height: 1px; } }'],
      ['a delay', '.a { animation: x 200ms ease-out 100ms; }'],
      ['a fill', '.a { animation: x 200ms ease-out forwards; }'],
      ['a raw hover', '.a:hover { opacity: 1; }'],
    ] as const) if (!fenceMotionProblems(css).length) problems.push(`planted ${what} is not seen`);
    const css = read(CSS);
    const f = fence(css);
    for (const name of ['stepIn', 'daySpring']) if (!keyframes(f, name)) problems.push(`@keyframes ${name} is missing from the polish fence`);
    problems.push(...fenceMotionProblems(f));
    // Outside the fence globals.css is the base byte for byte: the MP-16 sheen, pop and reduced-motion blocks included.
    if (sha(withoutFence(css)) !== baseCensus().projections[CSS]) problems.push('app/globals.css changed outside the polish fence');
    // Script motion: no smooth scroll and no Web Animations anywhere MP-25 touches; the pager reads the preference itself.
    for (const rel of [DATES, SHARED, SITEBAR, PAGER]) {
      let src = '';
      try { src = stripComments(read(rel)); } catch { continue; }
      if (/\bscroll(?:To|By|IntoView)\(|behavior:\s*'smooth'|\.animate\(/.test(src)) problems.push(`${rel}: script-driven scroll or Web Animations`);
    }
    const pager = await loadPager();
    if (!pager) problems.push(`${PAGER} does not exist`);
    else {
      if (!stripComments(read(PAGER)).includes("matchMedia('(prefers-reduced-motion: reduce)')")) problems.push('prefersReducedMotion does not read the media query');
      if (pager.settleTransition(true) !== 'none') problems.push('the settle transition runs under reduced motion');
    }
    const dates = stripComments(read(DATES));
    const body = (name: string) => new RegExp(`const ${name} = [\\s\\S]*?\\n {2}};`).exec(dates)?.[0] ?? '';
    if (!/prefersReducedMotion\(\)[^{]*\{\s*commit\(/.test(body('settle'))) problems.push('settle() does not land at once under reduced motion');
    if (!/if \(prefersReducedMotion\(\)\) \{\s*setVisibleMonth\(to\);/.test(body('page'))) problems.push('a chevron page does not land at once under reduced motion');
    const transitions = Array.from(dates.matchAll(/setTrack\([^,]+,\s*([^)]*\)?)\)/g), (m) => m[1].trim());
    if (!transitions.length || transitions.some((t) => t !== "'none'" && t !== 'settleTransition(false)')) problems.push(`the track's transitions: ${transitions.join(' | ')}`);
    expect(problems).toEqual([]);
  });

  it('a step enters with a short fade and rise while the chrome holds still', () => {
    const problems: string[] = [];
    const f = fence(read(CSS));
    const k = keyframes(f, 'stepIn');
    if (!k) problems.push('@keyframes stepIn is missing');
    else {
      const first = k.frames[0];
      const last = k.frames[k.frames.length - 1];
      const rise = Number(/translateY\((\d+(?:\.\d+)?)px\)/.exec(first)?.[1]);
      if (!/opacity:\s*0\b/.test(first) || !/opacity:\s*1\b/.test(last)) problems.push('stepIn is not a 0 to 1 fade');
      if (!(rise >= 4 && rise <= 8)) problems.push(`stepIn rises ${rise}px (4-8)`);
      if (!/translateY\(0(?:px)?\)/.test(last)) problems.push('stepIn does not end at rest');
    }
    const a = animations(f).find((x) => x.selector === '.animate-step-in');
    const d = ms(a?.times[0]);
    if (!a || !(d >= 200 && d <= 350) || !/\bease-out\b/.test(a.value)) problems.push(`.animate-step-in: ${a?.value ?? 'missing'} (200-350ms, ease-out)`);
    // ScreenShell: the entry on its own root, outside the contiguous scroll run; no gate; no key.
    const shell = elements(parseHtml(renderToStaticMarkup(createElement(ScreenShell, null, createElement('p', null, 'x'))))).find((e) => e.tag === 'div');
    const cls = shell?.attrs.class ?? '';
    if (!cls.includes('min-h-0 flex-1 overflow-y-auto')) problems.push(`ScreenShell lost its contiguous scroll run: ${cls}`);
    if (!cls.split(/\s+/).includes('animate-step-in') || cls.includes('min-h-0 animate-step-in') || cls.includes('flex-1 animate-step-in')) problems.push(`ScreenShell class: ${cls}`);
    if (/(?:^|\s)(?:pointer-events-none|invisible)(?:\s|$)/.test(cls) || 'inert' in (shell?.attrs ?? {})) problems.push('ScreenShell gates interaction during the entry');
    if (/\bkey=/.test(sliceFunction(stripComments(read(SHARED)), 'ScreenShell'))) problems.push('ScreenShell is keyed');
    // Replay (locate finding 6, mock mode cannot render Review's blocked branch): both returns put an unkeyed
    // ScreenShell first in a fragment, so React keeps the node when the quote resolves and the entry does not replay.
    const review = sliceFunction(stripComments(read(REVIEW)), 'ReviewStep');
    const shells = (review.match(/<ScreenShell\b/g) ?? []).length;
    const firsts = (review.match(/return \(\s*<>\s*<ScreenShell>/g) ?? []).length;
    if (shells !== 2 || firsts !== 2) problems.push(`ReviewStep: ${shells} ScreenShell tags, ${firsts} first in a fragment and unkeyed`);
    // BookingFlow untouched; no fixed-position element inside a step (a transformed ancestor would capture it).
    if (sha(read(FLOW)) !== baseCensus().frozen[FLOW]) problems.push('BookingFlow.tsx changed');
    for (const rel of [DATES, DRIVER, REVIEW]) if (literals(prepare(rel, read(rel))).some((s) => /(?:^|\s)(?:[\w-]+:)*fixed(?:\s|$)/.test(s))) problems.push(`${rel}: a fixed-position element inside a step`);
    expect(problems).toEqual([]);
  });
});
