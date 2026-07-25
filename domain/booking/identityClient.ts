import { getFunctionsBaseUrl, getSupabaseAnonKey } from './config';
import type { IdentityVerificationStart, IdentityVerificationState } from './publicContracts';

/**
 * Live (supabase-mode) client for the identity edge functions.
 * Ref: docs/rent/ID_VERIFICATION_PLAN.md §2; backend lives in
 * exotiq-spark-mvp-flow (identity-create-session / identity-session-status).
 *
 * The anon key is sent as the bearer token: it satisfies the functions
 * gateway's JWT check while keeping the caller anonymous. The guest path is
 * authorized by the booking's opaque `confirmation_token` (D4): the backend
 * looks the booking up by ref, requires the token to match, and derives the
 * customer from that row. Client-supplied identity is never trusted.
 */

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getSupabaseAnonKey()}`,
    apikey: getSupabaseAnonKey(),
  };
}

export async function createLiveIdentitySession(input: {
  bookingRef: string;
  /** D4 access token from the confirmation/verify link. Required by the backend. */
  confirmationToken: string;
  /**
   * Optional second factor. When sent it must equal the booking's stored
   * customer email or the backend 404s, so only send an email we actually
   * believe belongs to this booking — never a value the renter guessed.
   */
  email?: string;
}): Promise<IdentityVerificationStart> {
  const response = await fetch(`${getFunctionsBaseUrl()}/identity-create-session`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      booking_ref: input.bookingRef,
      confirmation_token: input.confirmationToken,
      ...(input.email ? { email: input.email } : {}),
    }),
  });
  const body = await response.json().catch(() => ({}));

  if (response.status === 409 || body.status === 'manual_review') {
    return { sessionId: body.session_id ?? '', status: 'manual_review' };
  }
  if (!response.ok) {
    throw new Error(body.error ?? `Verification could not be started (${response.status})`);
  }
  if (body.status === 'verified') {
    return { sessionId: body.session_id ?? '', status: 'verified', reused: Boolean(body.reused) };
  }
  return {
    sessionId: body.session_id,
    status: body.status ?? 'created',
    clientSecret: body.client_secret ?? undefined,
    hostedUrl: body.url ?? undefined,
  };
}

export async function getLiveIdentityState(sessionId: string): Promise<IdentityVerificationState> {
  const response = await fetch(
    `${getFunctionsBaseUrl()}/identity-session-status?session=${encodeURIComponent(sessionId)}`,
    { headers: headers() },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Status check failed (${response.status})`);
  }
  return {
    status: body.status,
    lastErrorReason: body.last_error_reason ?? undefined,
    attemptsRemaining: body.attempts_remaining ?? 0,
  };
}
