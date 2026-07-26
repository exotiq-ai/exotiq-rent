'use client';

import { Money, PrimaryButton } from '../BookingChrome';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import type { PublicQuote } from '@/domain/booking/publicContracts';
import { Breakdown, DepositHoldCard, QuoteNotice, ScreenShell, StepHeader, Sticky } from './shared';

export function ReviewStep({
  cart,
  goTo,
  next,
  quote,
  quotePending,
  quoteError,
  onRetryQuote,
  blocked,
}: {
  cart: BookingCart;
  goTo: (step: number) => void;
  next: () => void;
  /** Server figures; when present these are what the renter is agreeing to. */
  quote?: PublicQuote | null;
  quotePending?: boolean;
  quoteError?: string;
  onRetryQuote?: () => void;
  /** True when live pricing is unconfirmed — the renter must not advance. */
  blocked?: boolean;
}) {
  const dateLabel = formatRangeLabel(cart.dates.start, cart.dates.end);
  // Money comes from the server quote whenever we have one; the client engine
  // is only the fallback for mock mode, which has no backend to quote against.
  const m = quote ?? cart.totals;
  const days = quote ? quote.rentalDays : cart.totals.days;
  const platformPercent = Math.round(m.platformFeeRate * 100);

  // Only show operator line-items that carry a real amount — extras and the
  // operator tax are zero in the live flow, and a "$0" line reads as noise.
  const operatorRows: [string, string, number, (() => void)?][] = [
    ['Rental', `${days} × ${formatMoney(quote ? quote.dailyRateCents : cart.vehicle.dailyRateCents)}`, m.rentalSubtotalCents, () => goTo(1)],
  ];
  if (m.extrasSubtotalCents > 0) operatorRows.push(['Extras', `${cart.extras.length} selected`, m.extrasSubtotalCents, () => goTo(3)]);
  if (m.operatorTaxesCents > 0) operatorRows.push(['Taxes & fees', 'Operator tax estimate', m.operatorTaxesCents]);

  if (blocked) {
    return (
      <>
        <ScreenShell>
          <StepHeader eyebrow="Step 06" title="Here's the breakdown." sub="Review your details before payment." />
          <QuoteNotice pending={quotePending} message={quoteError} onRetry={onRetryQuote} />
        </ScreenShell>
        <Sticky><PrimaryButton onClick={next} disabled>{quotePending ? 'Getting final pricing…' : 'Proceed to payment'}</PrimaryButton></Sticky>
      </>
    );
  }

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 06" title="Here's the breakdown." sub="Review your details before payment." />
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-center text-[11px]"><div><span className="block text-[#848A9A]">Dates</span>{dateLabel}</div><div><span className="block text-[#848A9A]">Pickup</span>{cart.pickupTime}</div><div><span className="block text-[#848A9A]">Location</span>{cart.operator.city}</div></div>
        <Breakdown title="Operator" note={`Charge from ${cart.operator.name}`} rows={operatorRows} total={m.operatorTotalCents} />
        <Breakdown title="Exotiq.Rent" note="Booking fee + protection, charged separately by EXOTIQ.RENT" rows={[[`Booking fee (${platformPercent}%)`, 'Platform fee', m.platformFeeCents], ['Protection plan', cart.protection === 'decline' ? 'Declined — hold required later' : `${cart.protection} · ${days} days`, m.protectionTotalCents, () => goTo(4)]]} total={m.exotiqTotalCents} />
        <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4"><div className="flex items-center justify-between"><span className="text-sm text-[#9BA1B0]">Total due today</span><Money cents={m.grandTotalCents} large /></div></div>
        {/* Only disclose a deposit when there is an amount — "hold: $0" reads as
            an error. The amount is the operator's own setting, resolved
            server-side (per-vehicle override → tenant default). */}
        {m.depositHoldCents > 0 && (
          <DepositHoldCard amountCents={m.depositHoldCents} operatorName={cart.operator.name} />
        )}
        <details className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm text-[#F0F2F5]">
          <summary className="cursor-pointer font-medium">Free cancellation</summary>
          <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Cancel up to 72 hours before pickup for a full refund.</p>
          <div className="mt-3 space-y-1 text-xs leading-5 text-[#9BA1B0]">
            <div>After the free cancellation window:</div>
            <div>Booking fee ({platformPercent}%): non-refundable</div>
            <div>Protection plan: non-refundable</div>
            <div>Operator rental: per operator&apos;s cancellation policy</div>
          </div>
        </details>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next}>Proceed to payment</PrimaryButton></Sticky>
    </>
  );
}

