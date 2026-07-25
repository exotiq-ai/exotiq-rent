'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { getDataMode, getStripePublishableKey } from '@/domain/booking/config';
import { getIdentityVerificationState, startIdentityVerification } from '@/domain/booking/service';
import type { IdentityVerificationStatus } from '@/domain/booking/publicContracts';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90; // ~3 minutes, then show the still-processing note

/**
 * Post-payment identity verification (ID plan V1 ruling): payment is done,
 * verification is the step that confirms the booking. Mock mode simulates;
 * supabase mode opens the Stripe Identity modal and trusts the webhook-backed
 * status endpoint.
 *
 * `confirmationToken` is the D4 per-booking secret carried on the confirmation
 * (?t=) and verify (?token=) links. The backend requires it and derives the
 * customer from the booking it unlocks, so the renter is never asked to
 * re-identify themselves. We deliberately do NOT send an email alongside it:
 * the token already is the secret, and the old sessionStorage email was a
 * single global key, so a renter with two bookings could have booking B's
 * email cached while viewing booking A — which the backend's strict match
 * would 404, breaking a verification that token-only completes.
 */
export function IdentityVerificationCard({
  bookingRef,
  confirmationToken,
  initialStatus,
}: {
  bookingRef: string;
  confirmationToken?: string;
  initialStatus?: 'verified';
}) {
  const [status, setStatus] = useState<IdentityVerificationStatus | 'idle'>(initialStatus ?? 'idle');
  const [errorReason, setErrorReason] = useState<string | undefined>();
  /** Stripe-hosted verification URL, surfaced as an anchor once a session exists. */
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [slowNote, setSlowNote] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLive = getDataMode() === 'supabase';
  // A bare-ref visit (D4 restricted view) can show status but can never start
  // a session, so say so rather than offering a button that 400s.
  const missingToken = isLive && !confirmationToken;

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const poll = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    let polls = 0;
    pollTimer.current = setInterval(async () => {
      if (!sessionRef.current) return;
      polls += 1;
      if (polls > MAX_POLLS) setSlowNote(true);
      try {
        const state = await getIdentityVerificationState(sessionRef.current);
        if (state.status === 'verified' || state.status === 'requires_input' || state.status === 'manual_review') {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setErrorReason(state.lastErrorReason);
          setSlowNote(false);
          setStatus(state.status);
        }
      } catch {
        // Transient polling errors are ignored; the webhook remains the source of truth.
      }
    }, POLL_INTERVAL_MS);
  };

  const begin = async () => {
    if (missingToken) return;
    setStatus('processing');
    try {
      const start = await startIdentityVerification(bookingRef, { confirmationToken });
      if (start.status === 'verified') {
        setStatus('verified');
        return;
      }
      if (start.status === 'manual_review') {
        setStatus('manual_review');
        return;
      }
      sessionRef.current = start.sessionId;

      if (isLive && start.clientSecret && getStripePublishableKey()) {
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(getStripePublishableKey());
        if (!stripe) throw new Error('Stripe failed to load');
        const { error } = await stripe.verifyIdentity(start.clientSecret);
        if (error) {
          // Renter closed the modal or a pre-submit error occurred — back to the prompt.
          setStatus('idle');
          return;
        }
      } else if (isLive && start.hostedUrl) {
        // No publishable key configured — verification happens on Stripe's
        // hosted page. Do NOT window.open() here: this runs after an await, so
        // the user-gesture context is gone and browsers block the popup,
        // stranding the renter on "Verifying…" with no way to continue
        // (observed live, 2026-07-24). Surface a real anchor instead — the
        // renter's tap on it is a trusted gesture that always opens. A new tab
        // (not a redirect) is required because the session has no return_url,
        // so a redirect would strand them on Stripe's page.
        setHostedUrl(start.hostedUrl);
      }
      poll();
    } catch (err) {
      setErrorReason(err instanceof Error ? err.message : 'Verification could not be started.');
      setStatus('requires_input');
    }
  };

  if (status === 'verified') {
    return (
      <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#C8A664]/10 text-[#C8A664]"><BadgeCheck size={20} /></div>
          <div>
            <div className="text-sm font-medium text-[#F0F2F5]">Identity verified — booking confirmed</div>
            <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">You&apos;re all set. The operator has been notified.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'requires_input' || status === 'manual_review') {
    return (
      <div className="mt-4 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-4">
        <div className="text-sm font-medium text-[#FFB84D]">{status === 'manual_review' ? "We're reviewing your booking" : "Verification didn't go through"}</div>
        <p className="mt-1 text-xs leading-5 text-[#F0F2F5]">
          {status === 'manual_review'
            ? 'The operator has been notified and will be in touch shortly. Your booking is held in the meantime.'
            : errorReason ?? 'Your document could not be verified. Please try again.'}
        </p>
        {status === 'requires_input' && (
          <button type="button" onClick={begin} className="mt-3 rounded-lg border border-[#FFB84D]/45 px-4 py-2 text-xs font-semibold text-[#F0F2F5]">Try again</button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#C8A664]/10 text-[#C8A664]"><ShieldCheck size={20} /></div>
        <div className="flex-1">
          <div className="text-sm font-medium text-[#F0F2F5]">Confirm your booking — verify your identity</div>
          <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Takes about two minutes. Have your driver&apos;s license ready. Exotiq never stores your ID — documents are processed securely by Stripe, our verification partner.</p>
          {missingToken ? (
            <p className="mt-3 rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-xs leading-5 text-[#9BA1B0]">
              Open the link in your confirmation email to verify — it carries the
              secure access code for this booking.
            </p>
          ) : hostedUrl ? (
            <>
              <a
                href={hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8A664] px-5 py-3.5 text-sm font-semibold text-[#1A1308] transition active:scale-[0.99]"
              >
                <ShieldCheck size={16} />
                Continue to secure verification
              </a>
              <p className="mt-2 text-center text-[11px] leading-4 text-[#848A9A]">
                Opens Stripe in a new tab. Leave this page open — it updates on its own when you&apos;re done.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={begin}
              disabled={status === 'processing'}
              className="mt-3 w-full rounded-xl bg-[#C8A664] px-5 py-3.5 text-sm font-semibold text-[#1A1308] transition disabled:opacity-60"
            >
              {status === 'processing' ? 'Verifying…' : 'Verify identity'}
            </button>
          )}
          {status === 'processing' && slowNote && (
            <p className="mt-2 text-center text-[11px] text-[#848A9A]">Still processing — you can close this page; the operator sees the result either way.</p>
          )}
        </div>
      </div>
    </div>
  );
}
