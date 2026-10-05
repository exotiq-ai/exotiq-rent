'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancellationWindowState } from '@/domain/booking/payment';
import { postRenterCancel } from '@/domain/booking/rpcClient';
import { formatShortDate, tzDate } from '@/domain/booking/dates';

/**
 * M6c: renter self-serve cancellation, window-aware (M6-D5/D7).
 * Deliberately quiet — a text affordance below the fold, expanding to an
 * inline confirm. Free window cancels refund in full; inside 72h the copy
 * spells out the forfeit and the server demands the acknowledgement too.
 */
export function CancelBookingCard({
  bookingRef,
  accessToken,
  pickupAtIso,
  paid,
  timezone,
}: {
  bookingRef: string;
  accessToken: string;
  pickupAtIso: string;
  paid: boolean;
  /** Team timezone — the 72h deadline renders as the team-local date (T-6). */
  timezone?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const free = cancellationWindowState(pickupAtIso, Date.now()) === 'free';

  const cancel = async () => {
    if (working) return;
    setWorking(true);
    setError(undefined);
    try {
      await postRenterCancel(bookingRef, accessToken, !free);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed — please try again.');
      setWorking(false);
    }
  };

  if (!confirming) {
    return (
      <div className="mt-5 text-center">
        <button type="button" onClick={() => setConfirming(true)} className="text-body-sm text-faint underline decoration-line underline-offset-4 transition hover:text-muted">
          Cancel this booking
        </button>
        <p className="mt-1 text-label text-dim">
          {/* The date shown is the CANCEL-BY deadline (pickup − 72h) in the
              team's timezone — it used to print the pickup date itself, which
              read as three extra days of free cancellation (T-6). */}
          {free ? `Free cancellation — full refund until ${formatShortDate(tzDate(new Date(new Date(pickupAtIso).getTime() - 72 * 3600_000).toISOString(), timezone ?? 'UTC'))} (72h before pickup).` : 'The free cancellation window has passed.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-5 rounded-xl border p-4 ${free ? 'border-line bg-surface' : 'border-warn/45 bg-warn/10'}`}>
      <div className="text-body font-medium text-ink">{free ? 'Cancel this booking?' : 'Cancel and forfeit payments?'}</div>
      <p className="mt-1 text-body-sm leading-5 text-muted">
        {free
          ? paid
            ? 'You are inside the free window — both charges will be refunded in full and the dates released.'
            : 'Nothing has been charged — the reservation is simply released.'
          : paid
            ? 'The 72-hour window has passed: the rental, Trip Fees, and protection are non-refundable. Cancelling releases the dates without a refund.'
            : 'The 72-hour window has passed. Nothing has been charged; the reservation is released.'}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={cancel} disabled={working} className={`flex-1 rounded-xl px-4 py-3 text-body font-semibold disabled:opacity-60 ${free ? 'border border-line text-ink' : 'bg-warn text-goldInk'}`}>
          {working ? 'Cancelling…' : free ? 'Yes, cancel' : 'Cancel & forfeit'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={working} className="flex-1 rounded-xl bg-gold px-4 py-3 text-body font-semibold text-goldInk disabled:opacity-60">
          Keep booking
        </button>
      </div>
      {error && <p className="mt-3 text-body-sm leading-5 text-ink">{error}</p>}
    </div>
  );
}
