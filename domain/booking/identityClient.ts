import { getFunctionsBaseUrl, getSupabaseAnonKey } from './config';
import type { IdentityVerificationStart, IdentityVerificationState } from './publicContracts';

/**
 * Live (supabase-mode) client for the identity edge functions.
 * Ref: docs/rent/ID_VERIFICATION_PLAN.md §2; backend lives in
 * exotiq-spark-mvp-flow (identity-create-session / identity-session-status).
 *
 * The anon key is sent as the bearer token: it satisfies the functions
 * gateway's JWT check while keeping the caller anonymous — the guest path is
 * authorized server-side by re-deriving the customer from the email.
 */

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getSupabaseAnonKey()}`,
    apikey: getSupabaseAnonKey(),
  };
}

export async function createLiveIdentitySession(input: {
  email: string;
  bookingRef: string;
}): Promise<IdentityVerificationStart> {
  const response = await fetch(`${getFunctionsBaseUrl()}/identity-create-session`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email: input.email, booking_ref: input.bookingRef }),
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
