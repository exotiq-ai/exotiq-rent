'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { getDataMode, getStripePublishableKey } from '@/domain/booking/config';
import { getIdentityVerificationState, startIdentityVerification } from '@/domain/booking/service';
import type { IdentityVerificationStatus } from '@/domain/booking/publicContracts';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90; // ~3 minutes, then show the still-processing note

/** Set by the booking flow at payment so the guest confirmation page can start verification without re-asking. */
export const DRIVER_EMAIL_STORAGE_KEY = 'exotiq.driverEmail';

function storedDriverEmail(): string {
  try {
    return sessionStorage.getItem(DRIVER_EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Post-payment identity verification (ID plan V1 ruling): payment is done,
 * verification is the step that confirms the booking. Mock mode simulates;
 * supabase mode opens the Stripe Identity modal and trusts the webhook-backed
 * status endpoint.
 */
export function IdentityVerificationCard({ bookingRef, initialStatus }: { bookingRef: string; initialStatus?: 'verified' }) {
  const [status, setStatus] = useState<IdentityVerificationStatus | 'idle'>(initialStatus ?? 'idle');
  const [errorReason, setErrorReason] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [slowNote, setSlowNote] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLive = getDataMode() === 'supabase';

  useEffect(() => {
    setEmail(storedDriverEmail());
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
    const driverEmail = email.trim() || storedDriverEmail();
    if (isLive && !driverEmail.includes('@')) {
      setNeedsEmail(true);
      return;
    }
    setNeedsEmail(false);
    setStatus('processing');
    try {
      const start = await startIdentityVerification(bookingRef, driverEmail || undefined);
      if (start.status === 'verified') {
        setStatus('verified');
        return;
      }
      if (start.status === 'manual_review') {
        setStatus('manual_review');
        return;
      }
      sessionRef.current = start.sessionId;

      if (isLive && start.clientSecret) {
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(getStripePublishableKey());
        if (!stripe) throw new Error('Stripe failed to load');
        const { error } = await stripe.verifyIdentity(start.clientSecret);
        if (error) {
          // Renter closed the modal or a pre-submit error occurred — back to the prompt.
          setStatus('idle');
          return;
        }
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
          {isLive && needsEmail && (
            <label className="mt-3 block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Driver email on the booking</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-sm text-[#F0F2F5] outline-none transition placeholder:text-[#3D4250] focus:border-[#C8A664]/60"
              />
            </label>
          )}
          <button
            type="button"
            onClick={begin}
            disabled={status === 'processing'}
            className="mt-3 w-full rounded-xl bg-[#C8A664] px-5 py-3.5 text-sm font-semibold text-[#1A1308] transition disabled:opacity-60"
          >
            {status === 'processing' ? 'Verifying…' : 'Verify identity'}
          </button>
          {status === 'processing' && slowNote && (
            <p className="mt-2 text-center text-[11px] text-[#5C6272]">Still processing — you can close this page; the operator sees the result either way.</p>
          )}
        </div>
      </div>
    </div>
  );
}
