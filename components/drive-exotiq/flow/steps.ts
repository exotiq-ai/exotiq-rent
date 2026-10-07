import type { QuoteState } from '@/domain/booking/quote';

/**
 * The booking flow's steps (MP-26). Nothing is paid in the flow: the third step
 * carries the breakdown, the Protect choice, the terms and the request itself,
 * and payment happens later from the emailed payment link.
 */
export const FLOW_STEPS = [
  { key: 'dates', label: 'Dates' },
  { key: 'driver', label: 'Driver' },
  { key: 'review', label: 'Review' },
] as const;

/** The step that fetches the server quote and holds the request button (=== FLOW_STEPS.length). */
export const COMMIT_STEP = 3;

export const stepEyebrow = (n: number): string => `Step ${n} of ${FLOW_STEPS.length}`;

/**
 * Whether the flow should fetch a fresh quote now. Below the commit step it never
 * does (a quote per date tap burns the anonymous rate limit). On it, an idle state
 * fetches, and so does any state held for a different selection: quoteKey includes
 * the protection tier, so the T-12 toggle re-quotes. A state for the current key —
 * loading, ready or failed — does not: a failure waits for the renter's retry.
 */
export function shouldRequestQuote({ step, enabled, state, currentKey }: { step: number; enabled: boolean; state: QuoteState; currentKey: string }): boolean {
  if (!enabled || step < COMMIT_STEP) return false;
  if (state.status === 'idle') return true;
  return state.key !== currentKey;
}

/**
 * The request button. Inert while a request is in flight, while live pricing is
 * unconfirmed, and until the terms are accepted; active only on a ready quote.
 */
export function requestButtonState({ blocked, pending, termsAccepted, requesting }: { blocked: boolean; pending: boolean; termsAccepted: boolean; requesting: boolean }): { label: string; inert: boolean } {
  if (requesting) return { label: 'Sending request…', inert: true };
  if (blocked && pending) return { label: 'Getting final pricing…', inert: true };
  if (blocked) return { label: 'Request this booking', inert: true };
  if (!termsAccepted) return { label: 'Request this booking', inert: true };
  return { label: 'Request this booking', inert: false };
}

/** AC21: a handler that does nothing while a request is in flight. */
export function whileIdle<A extends unknown[]>(requesting: boolean, handler: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    if (!requesting) handler(...args);
  };
}
