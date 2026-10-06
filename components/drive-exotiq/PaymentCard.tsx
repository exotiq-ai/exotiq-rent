'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, CreditCard } from 'lucide-react';
import { Money } from './BookingChrome';
import { TwoPartyBreakdown } from './FeeCard';
import { foldFees } from './feeGroups';
import { paymentCountdownLabel, paymentWindowState } from '@/domain/booking/payment';
import { postRenterCheckout } from '@/domain/booking/rpcClient';
import { getBookingConfirmation } from '@/domain/booking/service';
import { ctaClassName } from '@/components/browse/tokens';

const CONFIRM_POLL_MS = 3000;
const CONFIRM_POLL_MAX = 40; // ~2 minutes of webhook grace

/** A note under the card: a heads-up (warn) or a failure that blocks the renter (danger). */
type Notice = { kind: 'warn' | 'danger'; text: string };

/**
 * M6b: the pay surface on the confirmation page for approved
 * (pending_payment) bookings. Renders only when payment_due_at is present —
 * which is also the staging gate: against a pre-M6b backend the field is
 * absent and this card never mounts.
 */
export function PaymentCard({
  bookingRef,
  accessToken,
  dueAtIso,
  rentalCents,
  platformFeeCents,
  protectionTotalCents,
  stateFeeCents = 0,
  processingFeeCents = 0,
  operatorTaxCents = 0,
  operatorTaxLabel,
  operatorName,
}: {
  bookingRef: string;
  accessToken: string;
  dueAtIso: string;
  rentalCents: number;
  platformFeeCents: number;
  protectionTotalCents: number;
  /** The Exotiq leg has four components. Defaulting these to 0 is safe only
   * because the backend returns 0 for bookings predating the fee columns —
   * for anything newer, omitting them under-quotes the renter. */
  stateFeeCents?: number;
  processingFeeCents?: number;
  /** Operator tax — INSIDE rentalCents (the operator-leg snapshot). Displayed
   * as its own line; never added to the total again (T-11). */
  operatorTaxCents?: number;
  operatorTaxLabel?: string;
  operatorName: string;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Must equal what rent-checkout charges as the Exotiq leg, which is all four
  // snapshot columns. Summing only two showed "Total due $1,224" on a booking
  // that charged $1,258.70 — verified live on BK-03459.
  const exotiqCents = platformFeeCents + protectionTotalCents + stateFeeCents + processingFeeCents;
  const windowState = paymentWindowState(dueAtIso, nowMs);

  // T-4: the poll exits on ANY post-payment movement — paid_at set, or the
  // status leaving pending_payment (confirmed, active, even an operator edit
  // back to pending_documents). The old exit condition was status ===
  // 'confirmed' only, so every other landing state spun the poll to its cap
  // and then showed a promise ("this page will update automatically") that
  // nothing kept.
  const startConfirmPoll = () => {
    if (pollTimer.current) return; // one poll, however many entry points
    let polls = 0;
    pollTimer.current = setInterval(async () => {
      polls += 1;
      if (polls > CONFIRM_POLL_MAX) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = null;
        setNotice({ kind: 'warn', text: 'Payment received — confirmation is taking a little longer than usual. Your payment is safe; reopen your booking link in a minute to see the receipt.' });
        return;
      }
      try {
        const lookup = await getBookingConfirmation(bookingRef, accessToken);
        if (lookup && !('restricted' in lookup) && lookup.live && (lookup.live.paidAt || lookup.live.status !== 'pending_payment')) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          // Review note: never leave the cleared ref truthy — the start guard
          // latches and no poll can ever run again (dev StrictMode remounts,
          // paid_at-before-status refreshes).
          pollTimer.current = null;
          router.refresh();
        }
      } catch {
        // transient — keep polling
      }
    }, CONFIRM_POLL_MS);
  };

  // Live countdown + return-from-Stripe handling.
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // Rental captured; the webhook is finishing the Exotiq leg. Poll until
      // the booking moves, then re-render the server page as the receipt.
      setFinalizing(true);
      startConfirmPoll();
    } else if (params.get('payment') === 'cancelled') {
      setNotice({ kind: 'warn', text: 'Payment was not completed — your reservation is still held. Pick up where you left off below.' });
    }
    return () => {
      clearInterval(tick);
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingRef, accessToken, router]);

  const pay = async () => {
    if (starting) return;
    setStarting(true);
    setNotice(undefined);
    try {
      const { url } = await postRenterCheckout(bookingRef, accessToken);
      window.location.assign(url);
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === 'rental_already_paid') {
        // T-4/audit: this used to strand a PAID renter on a permanent
        // "finalizing" card — no poll, no refresh, ever. Same poll as the
        // return-from-Stripe path.
        setFinalizing(true);
        startConfirmPoll();
      } else {
        setNotice({ kind: 'danger', text: err instanceof Error ? err.message : 'Payment could not be started — please try again.' });
      }
      setStarting(false);
    }
  };

  if (finalizing) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-ink" />
          <div>
            <div className="text-body font-medium text-ink">Payment received — finalizing</div>
            <p className="mt-1 text-body-sm leading-5 text-muted">Confirming your booking now. This usually takes a few seconds.</p>
          </div>
        </div>
        {notice && <p className="mt-3 text-body-sm leading-5 text-muted">{notice.text}</p>}
      </div>
    );
  }

  if (windowState === 'expired') {
    return (
      <div className="mt-4 rounded-xl border border-danger/45 bg-danger/10 p-4">
        <div className="text-body font-medium text-ink">Payment window closed</div>
        <p className="mt-1 text-body-sm leading-5 text-muted">The 48-hour payment window for this booking has passed and the dates may have been released. Contact {operatorName} or book again.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body font-medium text-ink">Approved — complete payment</div>
          <p className="mt-1 text-body-sm leading-5 text-muted">{operatorName} approved your booking. Pay to lock it in.</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label ${windowState === 'urgent' ? 'bg-warn/15 text-warn' : 'bg-surface2 text-ink'}`}>
          <Clock3 size={14} />
          {paymentCountdownLabel(dueAtIso, nowMs)}
        </span>
      </div>
      {/* The two charges, each itemised and subtotalled (MP-26). This surface
          holds no platform percent or state-fee label, so the Trip-fees detail
          uses generic labels rather than guessing either. */}
      <TwoPartyBreakdown
        groups={foldFees({
          operatorName,
          operatorTotalCents: rentalCents,
          operatorTaxCents,
          operatorTaxLabel,
          platformFeeCents,
          protectionTotalCents,
          stateFeeCents,
          processingFeeCents,
          exotiqTotalCents: exotiqCents,
        })}
      />
      <div className="mt-3 text-body">
        <div data-money="total" className="flex justify-between gap-3 border-t border-line pt-2 font-medium text-ink"><span>Total due</span><span className="text-gold"><Money cents={rentalCents + exotiqCents} large /></span></div>
      </div>
      <p className="mt-2 text-body-sm leading-5 text-faint">Two charges on your statement: the operator&apos;s rental, and an EXOTIQ RENT charge covering Trip fees, protection, the state rental fee and card processing. One card entry.</p>
      <button
        type="button"
        onClick={pay}
        disabled={starting}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-body font-semibold disabled:opacity-60 ${ctaClassName}`}
      >
        <CreditCard size={16} />
        {starting ? 'Opening secure checkout…' : 'Complete payment'}
      </button>
      {notice && <p className={`mt-3 rounded-xl border p-3 text-body-sm leading-5 text-ink ${notice.kind === 'danger' ? 'border-danger/45 bg-danger/10' : 'border-warn/45 bg-warn/10'}`}>{notice.text}</p>}
    </div>
  );
}
