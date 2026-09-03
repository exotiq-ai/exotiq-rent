/**
 * Drive Exotiq browse tokens (MP-3 / M7b).
 *
 * Extracted from what the booking flow actually renders — not a repo-wide
 * refactor of its hex literals. New marketplace code reads these; the flow
 * keeps its literals until a dedicated pass. Brand: Drive Exotiq (decision
 * 2026-08-21). Verified blue is the Exotiq mark's accent, reserved for the
 * Verified badge only.
 */
export const tone = {
  ground: '#06070a',
  panel: '#0D0F14',
  surface: '#161922',
  surface2: '#1E2230',
  line: '#2A2E3A',
  ink: '#F0F2F5',
  muted: '#9BA1B0',
  faint: '#848A9A',
  gold: '#C8A664',
  verified: '#6EC1E4',
} as const;

export const serifFamily = 'var(--font-drive-newsreader), Georgia, serif';

/** The display-type recipe every headline on the booking surfaces uses. */
export const serifStyle = { fontFamily: serifFamily, fontWeight: 500, letterSpacing: '-0.014em' } as const;

/** Page container shared by header, hero, grid and footer. */
export const containerClassName = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
