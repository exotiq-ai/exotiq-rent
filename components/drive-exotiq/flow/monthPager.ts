/**
 * The Dates month pager's arithmetic (MP-25): which axis a touch belongs to, how far the grid
 * follows the finger, and whether a release pages. Pure functions plus two browser reads; no class
 * strings here (the month grid and its gold stay in DatesStep, where the restraint budget counts them).
 */

export type PageDir = -1 | 0 | 1;
export type Sample = { x: number; y: number; t: number };

/** Movement under this many px decides nothing yet (a tap stays a tap). */
export const SLOP_PX = 8;
/** A release past half the grid's width pages. */
export const DISTANCE_RATIO = 0.5;
/** A flick pages from this fraction of the width when it is fast enough. */
export const FLICK_MIN_RATIO = 0.15;
/** Release speed, in px per ms, that counts as a flick (a 25% flick in 100ms is about 0.9). */
export const FLICK_VELOCITY = 0.35;
/** Past the first or last month the grid still follows (at 60% of the finger, so a little resistance) and settles back. */
export const EDGE_RESISTANCE = 0.6;
/** The slide a chevron tap and a released swipe settle with (AC2: within 400ms of the tap). */
export const SETTLE_MS = 280;
/** Release speed is read over the last stretch of the gesture, not its average. */
const VELOCITY_WINDOW_MS = 80;

/** Which axis a touch belongs to once it leaves the slop: vertical wins ties, so a mostly vertical drag scrolls the step. */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < SLOP_PX) return null;
  return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
}

/** The grid's offset for a finger travel of dx: one to one, or resisted where there is no month to show. */
export function dragOffset(dx: number, canPrev: boolean, canNext: boolean, width: number): number {
  const blocked = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
  const offset = blocked ? dx * EDGE_RESISTANCE : dx;
  return Math.max(-width, Math.min(width, offset));
}

/** The x speed in px per ms over the last VELOCITY_WINDOW_MS of samples (0 with fewer than two). */
export function releaseVelocity(samples: Sample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const from = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? samples[0];
  const first = from === last ? samples[samples.length - 2] : from;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/** Whether a release pages: 1 shows the next month (finger right to left), -1 the previous, 0 settles back. Never more than one. */
export function pageDecision({ dx, width, velocity, canPrev, canNext }: { dx: number; width: number; velocity: number; canPrev: boolean; canNext: boolean }): PageDir {
  if (width <= 0 || dx === 0) return 0;
  const ratio = Math.abs(dx) / width;
  const flick = ratio >= FLICK_MIN_RATIO && Math.abs(velocity) >= FLICK_VELOCITY && Math.sign(velocity) === Math.sign(dx);
  if (ratio < DISTANCE_RATIO && !flick) return 0;
  const dir: PageDir = dx < 0 ? 1 : -1;
  if ((dir === 1 && !canNext) || (dir === -1 && !canPrev)) return 0;
  return dir;
}

/** The track's transition for a settle: transform only, and none at all under reduced motion. */
export const settleTransition = (reduced: boolean): string => (reduced ? 'none' : `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`);

/** The reader's motion preference, read when a page starts (the global CSS block cannot reach a script's settle). */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** React 18 has no typed inert prop: the month sliding in is made inert by ref (not focusable, out of the accessibility tree). */
export const markInert = (el: HTMLElement | null): void => {
  el?.setAttribute('inert', '');
};
