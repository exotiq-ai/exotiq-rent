'use client';

import { useState } from 'react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import type { PublicQuote } from '@/domain/booking/publicContracts';
import { Breakdown, DepositDisclosure, QuoteNotice, ScreenShell, StepHeader, Sticky } from './shared';

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
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Only the rental row is navigable now. The extras and protection rows used
  // to link to goTo(3)/goTo(4); with those steps deleted those indices are
  // Review and Pay, so tapping "protection" would have jumped the renter
  // FORWARD to payment. Extras can no longer be non-zero either.
  const operatorRows: [string, string, number, (() => void)?][] = [
    ['Rental', `${days} × ${formatMoney(quote ? quote.dailyRateCents : cart.vehicle.dailyRateCents)}`, m.rentalSubtotalCents, () => goTo(1)],
  ];
  if (m.operatorTaxesCents > 0) operatorRows.push(['Taxes & fees', 'Operator tax estimate', m.operatorTaxesCents]);

  // Every component of exotiqTotalCents must be itemised. The server added
  // processing and state fees into that total, and rendering only the first two
  // rows left $264 of a $1,842 section unexplained — visible in production.
  // These come straight off the quote; mock mode has neither and shows neither.
  const exotiqRows: [string, string, number, (() => void)?][] = [
    ['Trip Fees', `${platformPercent}% of the rental`, m.platformFeeCents],
    ['Protection', `Included · ${days} days`, m.protectionTotalCents],
  ];
  if (quote?.stateFeeCents) exotiqRows.push([quote.stateFeeLabel ?? 'State rental fee', `${days} days`, quote.stateFeeCents]);
  if (quote?.processingFeeCents) exotiqRows.push(['Processing fees', 'Card processing', quote.processingFeeCents]);

  if (blocked) {
    return (
      <>
        <ScreenShell>
          <StepHeader eyebrow="Step 04" title="Here's the breakdown." sub="Review your details before payment." />
          <QuoteNotice pending={quotePending} message={quoteError} onRetry={onRetryQuote} />
        </ScreenShell>
        <Sticky><PrimaryButton onClick={next} disabled>{quotePending ? 'Getting final pricing…' : 'Proceed to payment'}</PrimaryButton></Sticky>
      </>
    );
  }

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 04" title="Here's the breakdown." />
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-center text-[11px]"><div><span className="block text-[#848A9A]">Dates</span>{dateLabel}</div><div><span className="block text-[#848A9A]">Pickup</span>{cart.pickupTime}</div><div><span className="block text-[#848A9A]">Location</span>{cart.operator.city}</div></div>
        <Breakdown title="Operator" note={`Charge from ${cart.operator.name}`} rows={operatorRows} total={m.operatorTotalCents} />
        {/* Protection is included, not chosen — the tier step is gone, so this
            row states what is covered rather than offering a way back to a
            selection that no longer exists. */}
        <Breakdown title="Exotiq.Rent" note="Charged separately by EXOTIQ.RENT" rows={exotiqRows} total={m.exotiqTotalCents} />
        <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4"><div className="flex items-center justify-between"><span className="text-sm text-[#9BA1B0]">Total due today</span><Money cents={m.grandTotalCents} large /></div></div>
        {/* Unconditional: the deposit is the operator's to collect at pickup and
            Exotiq quotes no amount, so there is no value to gate on. */}
        <DepositDisclosure operatorName={cart.operator.name} />
        {/* One collapsed policy affordance, not three. Cancellation terms and
            what protection covers were separate blocks competing for the same
            attention; neither is read at this moment, both must be available. */}
        <details className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm text-[#F0F2F5]">
          <summary className="cursor-pointer font-medium">Cancellation &amp; coverage</summary>
          <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Free cancellation up to 72 hours before pickup. After that, Trip Fees and protection are non-refundable and the rental follows {cart.operator.name}&apos;s policy.</p>
          <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Protection is included on every booking: $0 deductible, collision, theft and liability to $250K, roadside assistance.</p>
        </details>
        <label className="mt-4 flex gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-xs leading-5 text-[#F0F2F5]">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#C8A664]"
          />
          <span>I agree to the <span className="text-[#C8A664] underline underline-offset-2">Rental Terms &amp; Conditions</span>.</span>
        </label>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next} disabled={!termsAccepted}>Proceed to payment</PrimaryButton></Sticky>
    </>
  );
}

