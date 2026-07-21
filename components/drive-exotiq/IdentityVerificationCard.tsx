'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { getIdentityVerificationState, startIdentityVerification } from '@/domain/booking/service';
import type { IdentityVerificationStatus } from '@/domain/booking/publicContracts';

const POLL_INTERVAL_MS = 1000;

/**
 * Post-payment identity verification (ID plan V1 ruling): payment is done,
 * verification is the step that confirms the booking. Renders on the
 * confirmation screen, first position under the hero.
 */
export function IdentityVerificationCard({ bookingRef }: { bookingRef: string }) {
  const [status, setStatus] = useState<IdentityVerificationStatus | 'idle'>('idle');
  const [errorReason, setErrorReason] = useState<string | undefined>();
  const sessionRef = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  const poll = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      if (!sessionRef.current) return;
      const state = await getIdentityVerificationState(sessionRef.current);
      if (state.status === 'verified' || state.status === 'requires_input' || state.status === 'manual_review') {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setErrorReason(state.lastErrorReason);
        setStatus(state.status);
      }
    }, POLL_INTERVAL_MS);
  };

  const begin = async () => {
    setStatus('processing');
    const start = await startIdentityVerification(bookingRef);
    if (start.status === 'verified') {
      setStatus('verified');
      return;
    }
    sessionRef.current = start.sessionId;
    // Live mode: stripe.verifyIdentity(start.clientSecret) opens the Stripe
    // modal here; the webhook flips the status we poll for.
    poll();
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
          <button
            type="button"
            onClick={begin}
            disabled={status === 'processing'}
            className="mt-3 w-full rounded-xl bg-[#C8A664] px-5 py-3.5 text-sm font-semibold text-[#1A1308] transition disabled:opacity-60"
          >
            {status === 'processing' ? 'Verifying…' : 'Verify identity'}
          </button>
        </div>
      </div>
    </div>
  );
}
