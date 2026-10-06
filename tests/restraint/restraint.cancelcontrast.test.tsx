// MP-21 AC1, AC2: the renter-facing cancellation sentence is legible. The sentence ("Free cancellation —
// full refund until <date> (72h before pickup)." and "The free cancellation window has passed.") sat in
// the dim token at 1.91:1 on the panel, under the 4.5:1 AA minimum; it now wears the faint token.
// AC1 renders CancelBookingCard at rest with react-dom/server (next/navigation mocked, only Date faked)
// in both window states and reads the paragraph's class list. AC2 holds the palette premise: faint
// clears 4.5:1 on every surface the card can sit on and dim does not. Colours come from the tone
// palette, never from typed hex. Each checker runs on the real thing and on planted faults, so the
// test cannot pass by checking nothing.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
}));

import { CancelBookingCard } from '@/components/drive-exotiq/CancelBookingCard';
import { tone } from '../../components/browse/tokens';
import { NOW_ISO, classes, elements, norm, parseHtml, textOf } from '../fees/fixtures';
import { contrast } from './restraintScan';

const palette = tone as unknown as Record<string, string>;
const FLOOR = 4.5;
const HOUR = 3600_000;
const at = (ms: number) => new Date(Date.parse(NOW_ISO) + ms).toISOString();

type WindowState = 'free' | 'passed';
// Pickup 10 days out is far inside the free window (deadline = NOW + 7 days = Nov 8, UTC); 24 hours out is far outside it.
const PICKUP: Record<WindowState, string> = { free: at(240 * HOUR), passed: at(24 * HOUR) };
const SENTENCE: Record<WindowState, string> = {
  free: 'Free cancellation — full refund until Nov 8 (72h before pickup).',
  passed: 'The free cancellation window has passed.',
};
const GOOD = 'mt-1 text-label text-faint';
const REQUIRED = ['text-faint', 'mt-1', 'text-label'];
const FORBIDDEN = ['text-dim', 'text-dim2'];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
});
afterAll(() => {
  vi.useRealTimers();
});

const renderCard = (state: WindowState) =>
  renderToStaticMarkup(<CancelBookingCard bookingRef="BK-MP21" accessToken="tok_mp21_fixture" pickupAtIso={PICKUP[state]} paid timezone="UTC" />);

/** Problems with the cancellation-sentence paragraph in one rendered at-rest card ([] when it is right). */
export function sentenceProblems(html: string, state: WindowState): string[] {
  // The at-rest card has exactly one <p> (the confirm panel's are in the other branch), so a reworded
  // sentence is reported as reworded and not as "not found".
  const found = elements(parseHtml(html)).filter((e) => e.tag === 'p');
  if (found.length !== 1) return [`${state}: expected one sentence paragraph, found ${found.length}`];
  const text = norm(textOf(found[0]));
  const have = classes(found[0]);
  const problems: string[] = [];
  if (text !== SENTENCE[state]) problems.push(`${state}: sentence reads "${text}"`);
  for (const c of REQUIRED) if (!have.includes(c)) problems.push(`${state}: ${c} missing`);
  for (const c of FORBIDDEN) if (have.includes(c)) problems.push(`${state}: ${c} present`);
  return problems;
}

const para = (cls: string, text: string) => `<div class="mt-5 text-center"><button type="button">Cancel this booking</button><p class="${cls}">${text}</p></div>`;
const PLANTED: { why: string; state: WindowState; html: string; names: string }[] = [
  { why: 'text-dim left in place', state: 'passed', html: para('mt-1 text-label text-dim', SENTENCE.passed), names: 'text-dim present' },
  { why: 'text-dim2 substituted', state: 'free', html: para('mt-1 text-label text-dim2', SENTENCE.free), names: 'text-dim2 present' },
  { why: 'another token substituted', state: 'free', html: para('mt-1 text-label text-muted', SENTENCE.free), names: 'text-faint missing' },
  { why: 'text-faint added while text-dim stays', state: 'passed', html: para('mt-1 text-label text-faint text-dim', SENTENCE.passed), names: 'text-dim present' },
  { why: 'mt-1 dropped', state: 'free', html: para('text-label text-faint', SENTENCE.free), names: 'mt-1 missing' },
  { why: 'text-label dropped', state: 'passed', html: para('mt-1 text-faint', SENTENCE.passed), names: 'text-label missing' },
  { why: 'free sentence reworded', state: 'free', html: para(GOOD, 'Free cancellation until Nov 8.'), names: 'sentence reads' },
  { why: 'passed sentence reworded', state: 'passed', html: para(GOOD, 'The window has passed.'), names: 'sentence reads' },
  { why: 'paragraph gone', state: 'free', html: '<div class="mt-5 text-center"><button type="button">Cancel this booking</button></div>', names: 'found 0' },
];

const PAIRS = [['faint', 'panel'], ['faint', 'ground'], ['faint', 'surface'], ['dim', 'panel']] as const;
const WANT_KEYS = ['faint/panel', 'faint/ground', 'faint/surface', 'dim/panel'];

/** Contrast of each pair, and the problems with the premise: faint clears the floor on every surface, dim does not. */
export function contrastProblems(colours: Record<string, string>, pairs: readonly (readonly [string, string])[] = PAIRS) {
  const ratios: Record<string, number> = {};
  const problems: string[] = [];
  for (const [fg, bg] of pairs) {
    const ratio = contrast(colours[fg], colours[bg]);
    ratios[`${fg}/${bg}`] = ratio;
    if (fg === 'faint' && ratio < FLOOR) problems.push(`faint on ${bg} is ${ratio.toFixed(2)}, below ${FLOOR}`);
    if (fg === 'dim' && ratio >= FLOOR) problems.push(`dim on ${bg} is ${ratio.toFixed(2)}, no longer below ${FLOOR}: the ticket's premise changed`);
  }
  return { ratios, problems };
}

describe('MP-21 cancellation sentence contrast (AC1, AC2)', () => {
  it('cancellation-window sentence wears the faint token in both window states', () => {
    // The checker can fail: a right paragraph is clean and every planted fault is named.
    expect(sentenceProblems(para(GOOD, SENTENCE.free), 'free')).toEqual([]);
    expect(sentenceProblems(para(GOOD, SENTENCE.passed), 'passed')).toEqual([]);
    for (const p of PLANTED) {
      const problems = sentenceProblems(p.html, p.state);
      expect(problems.some((x) => x.includes(p.names)), `${p.why}: ${JSON.stringify(problems)}`).toBe(true);
    }
    // The real card goes last, so a red run on the unmodified card names text-dim and not a harness fault.
    for (const state of ['free', 'passed'] as const) expect(sentenceProblems(renderCard(state), state)).toEqual([]);
  });

  it('faint clears 4.5:1 on every surface the card can sit on and dim does not', () => {
    // Planted: faint edited below the floor, dim lifted above it, one pair dropped from the check.
    expect(contrastProblems({ ...palette, faint: palette.dim2 }).problems.some((x) => x.startsWith('faint on panel'))).toBe(true);
    expect(contrastProblems({ ...palette, dim: palette.muted }).problems.some((x) => x.startsWith('dim on panel'))).toBe(true);
    expect(Object.keys(contrastProblems(palette, PAIRS.slice(1)).ratios)).not.toEqual(WANT_KEYS);
    // The real palette.
    const real = contrastProblems(palette);
    expect(Object.keys(real.ratios)).toEqual(WANT_KEYS);
    expect(real.problems).toEqual([]);
  });
});
