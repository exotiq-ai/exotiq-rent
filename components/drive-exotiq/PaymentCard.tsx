'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, CreditCard } from 'lucide-react';
import { Money } from './BookingChrome';
import { paymentCountdownLabel, paymentWindowState } from '@/domain/booking/payment';
import { postRenterCheckout } from '@/domain/booking/rpcClient';
import { getBookingConfirmation } from '@/domain/booking/service';

const CONFIRM_POLL_MS = 3000;
const CONFIRM_POLL_MAX = 40; // ~2 minutes of webhook grace

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
  operatorName,
}: {
  bookingRef: string;
  accessToken: string;
  dueAtIso: string;
  rentalCents: number;
  platformFeeCents: number;
  protectionTotalCents: number;
  operatorName: string;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const exotiqCents = platformFeeCents + protectionTotalCents;
  const windowState = paymentWindowState(dueAtIso, nowMs);

  // Live countdown + return-from-Stripe handling.
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // Rental captured; the webhook is finishing the Exotiq leg. Poll until
      // the booking flips, then re-render the server page as the receipt.
      setFinalizing(true);
      let polls = 0;
      pollTimer.current = setInterval(async () => {
        polls += 1;
        if (polls > CONFIRM_POLL_MAX) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setNotice('Payment received — confirmation is taking longer than usual. This page will update automatically; you can safely close it.');
          return;
        }
        try {
          const lookup = await getBookingConfirmation(bookingRef, accessToken);
          if (lookup && !('restricted' in lookup) && lookup.live?.status === 'confirmed') {
            if (pollTimer.current) clearInterval(pollTimer.current);
            router.refresh();
          }
        } catch {
          // transient — keep polling
        }
      }, CONFIRM_POLL_MS);
    } else if (params.get('payment') === 'cancelled') {
      setNotice('Payment was not completed — your reservation is still held. Pick up where you left off below.');
    }
    return () => {
      clearInterval(tick);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
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
        setFinalizing(true);
      } else {
        setNotice(err instanceof Error ? err.message : 'Payment could not be started — please try again.');
      }
      setStarting(false);
    }
  };

  if (finalizing) {
    return (
      <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#C8A664]/10 text-[#C8A664]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#C8A664]" />
          </div>
          <div>
            <div className="text-sm font-medium text-[#F0F2F5]">Payment received — finalizing</div>
            <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Confirming your booking now. This usually takes a few seconds.</p>
          </div>
        </div>
        {notice && <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">{notice}</p>}
      </div>
    );
  }

  if (windowState === 'expired') {
    return (
      <div className="mt-4 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-4">
        <div className="text-sm font-medium text-[#F0F2F5]">Payment window closed</div>
        <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">The 48-hour payment window for this booking has passed and the dates may have been released. Contact {operatorName} or book again.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[#F0F2F5]">Approved — complete payment</div>
          <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">{operatorName} approved your booking. Pay to lock it in.</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${windowState === 'urgent' ? 'bg-[#FFB84D]/15 text-[#FFB84D]' : 'bg-[#C8A664]/10 text-[#C8A664]'}`}>
          <Clock3 size={12} />
          {paymentCountdownLabel(dueAtIso, nowMs)}
        </span>
      </div>
      <div className="mt-4 space-y-2 border-t border-[#2A2E3A] pt-3 text-sm">
        <div className="flex justify-between gap-3"><span className="text-[#9BA1B0]">{operatorName} rental</span><Money cents={rentalCents} /></div>
        <div className="flex justify-between gap-3"><span className="text-[#9BA1B0]">Exotiq booking fee + protection</span><Money cents={exotiqCents} /></div>
        <div className="flex justify-between gap-3 border-t border-[#2A2E3A] pt-2 font-medium text-[#F0F2F5]"><span>Total due</span><Money cents={rentalCents + exotiqCents} large /></div>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5C6272]">Two charges on your statement: the operator&apos;s rental, and an EXOTIQ RENT charge for fee + protection. One card entry.</p>
      <button
        type="button"
        onClick={pay}
        disabled={starting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8A664] px-5 py-4 text-sm font-semibold text-[#1A1308] transition active:scale-[0.99] disabled:opacity-60"
      >
        <CreditCard size={16} />
        {starting ? 'Opening secure checkout…' : 'Complete payment'}
      </button>
      {notice && <p className="mt-3 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-3 text-xs leading-5 text-[#F0F2F5]">{notice}</p>}
    </div>
  );
}
