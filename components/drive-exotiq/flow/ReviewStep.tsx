'use client';

import { useState } from 'react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart, ProtectionTier } from '@/domain/booking/types';
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
  onProtectionChange,
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
  /** T-12: premium is the default; the renter may toggle to declined while
   * the protect-plan T&C are finalized. Only these two tiers are offered. */
  onProtectionChange?: (tier: Extract<ProtectionTier, 'premium' | 'decline'>) => void;
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
  // Server-named tax line (2026-08-17): "Tax · 7.5% — charged by {operator}".
  // Older quote shapes carry no label/rate and keep the generic copy.
  if (m.operatorTaxesCents > 0) {
    operatorRows.push([
      quote?.operatorTaxLabel ?? 'Taxes & fees',
      quote?.operatorTaxRate != null ? `${quote.operatorTaxRate}% · charged by ${cart.operator.name}` : 'Operator tax estimate',
      m.operatorTaxesCents,
    ]);
  }

  // Every component of exotiqTotalCents must be itemised. The server added
  // processing and state fees into that total, and rendering only the first two
  // rows left $264 of a $1,842 section unexplained — visible in production.
  // These come straight off the quote; mock mode has neither and shows neither.
  const protectionOn = cart.protection !== 'decline';
  const exotiqRows: [string, string, number, (() => void)?][] = [
    ['Trip Fees', `${platformPercent}% of the rental`, m.platformFeeCents],
  ];
  // T-12: protection is a choice now — a $0 "Protection" row under a declined
  // toggle reads as a glitch, so the row exists only when protection does.
  if (protectionOn) exotiqRows.push(['Exotiq Protect', `Premium · ${days} days`, m.protectionTotalCents]);
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
        {/* T-12: Exotiq Protect is premium-by-default with a single decline
            toggle (no tier menu). Toggling recomputes the cart; quoteKey
            includes the tier, so the flow blocks on a fresh server quote
            before the renter can commit either way. */}
        {onProtectionChange && (
          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#F0F2F5]">Exotiq Protect</div>
                <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">
                  {protectionOn
                    ? // Rate from the same source as the charged row (m), not the
                      // client constant — review note: constant drift would make
                      // this subtitle contradict the row it sits above.
                      `Premium coverage · ${formatMoney(m.protectionDailyRateCents)}/day`
                    : `Declined — you're responsible for damage under ${cart.operator.name}'s rental agreement.`}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={protectionOn}
                aria-label="Exotiq Protect"
                onClick={() => onProtectionChange(protectionOn ? 'decline' : 'premium')}
                className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161922] ${protectionOn ? 'bg-[#C8A664]' : 'bg-[#2A2E3A]'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-[#F0F2F5] shadow-[0_1px_2px_rgba(0,0,0,.4)] transition-all ${protectionOn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        )}
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
          {/* T-6: this mirrors the platform-enforced rule (and the derived
              cancellation_policy text snapshotted on every booking) — the old
              copy claimed post-72h refunds "follow the operator's policy",
              which no code implements. */}
          <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Free cancellation until 72 hours before your scheduled pickup — both charges refunded in full. Within 72 hours of pickup, the booking total is non-refundable.</p>
          {/* T-6: no specific coverage figures until the protect-plan T&C are
              finalized — the old "$0 deductible / $250K liability / roadside"
              line asserted terms no document backs. Neutral, true, and gone
              entirely when protection is declined. */}
          {protectionOn && (
            <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Exotiq Protect covers damage to the vehicle during your rental period. Full coverage terms are provided before pickup.</p>
          )}
        </details>
        <label className="mt-4 flex gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-xs leading-5 text-[#F0F2F5]">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="control-check mt-0.5"
          />
          <span>I agree to the <span className="text-[#C8A664] underline underline-offset-2">Rental Terms &amp; Conditions</span>.</span>
        </label>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next} disabled={!termsAccepted}>Proceed to payment</PrimaryButton></Sticky>
    </>
  );
}

