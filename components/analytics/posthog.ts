/**
 * Funnel analytics (M7e / MP-6, decision 2026-08-21: PostHog).
 *
 * Loaded from PostHog's own snippet, not an npm dependency: nothing ships in
 * the bundle and nothing runs unless NEXT_PUBLIC_POSTHOG_KEY is set on the
 * deploy. Every call below is a no-op without it, so the same build serves
 * hosts with and without analytics.
 *
 * Event names are the funnel the marketplace exists to measure:
 *   browse_view → vehicle_view → book_start → book_step → booking_created
 *   → confirmation_view
 * Keep them stable; dashboards key on them.
 */
export type FunnelEvent =
  | 'browse_view'
  | 'vehicle_view'
  | 'book_start'
  | 'book_step'
  | 'booking_created'
  | 'confirmation_view';

type PostHogLike = { capture: (event: string, properties?: Record<string, unknown>) => void };

export function posthogKey(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
}

export function posthogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
}

export function track(event: FunnelEvent, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const ph = (window as unknown as { posthog?: PostHogLike }).posthog;
  if (!ph || typeof ph.capture !== 'function') return;
  ph.capture(event, properties);
}
