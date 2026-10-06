'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { TwoPartyBreakdown } from '../FeeCard';
import { foldFees } from '../feeGroups';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart, BookingTotals, ProtectionTier } from '@/domain/booking/types';
import type { PublicQuote } from '@/domain/booking/publicContracts';
import { DepositDisclosure, QuoteNotice, ScreenShell, StepHeader, Sticky } from './shared';
import { requestButtonState, stepEyebrow } from './steps';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { CONSENT_TEXT } from '@/domain/renters/consentText';

type ProtectChoice = Extract<ProtectionTier, 'premium' | 'decline'>;

/**
 * Review & Request (MP-26): the flow's last step and its one money moment.
 * Nothing is charged here. The renter sees who charges what, chooses Protect,
 * accepts the terms and sends the request; the operator approves it, and
 * payment happens later from the emailed payment link.
 */
export function ReviewStep({
  cart,
  goTo,
  quote,
  quotePending,
  quoteError,
  onRetryQuote,
  blocked,
  onProtectionChange,
  onMarketingConsentChange,
  onRequest,
  requesting = false,
  requestError,
}: {
  cart: BookingCart;
  goTo: (step: number) => void;
  /** Server figures; when present these are what the renter is agreeing to. */
  quote?: PublicQuote | null;
  quotePending?: boolean;
  quoteError?: string;
  onRetryQuote?: () => void;
  /** MP-14: present when the host runs renter capture; the line renders only then. */
  onMarketingConsentChange?: (checked: boolean) => void;
  /** True when live pricing is unconfirmed — the renter must not request. */
  blocked?: boolean;
  /** T-12: premium is the default; the renter may toggle to declined while
   * the protect-plan T&C are finalized. Only these two tiers are offered. */
  onProtectionChange?: (tier: ProtectChoice) => void;
  /** Sends the booking request (BookingFlow's reserve). */
  onRequest: () => void;
  requesting?: boolean;
  requestError?: string;
}) {
  const dateLabel = formatRangeLabel(cart.dates.start, cart.dates.end);
  // Money comes from the server quote whenever we have one; the client engine
  // is only the fallback for mock mode, which has no backend to quote against.
  const m = quote ?? cart.totals;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const protectionOn = cart.protection !== 'decline';
  const button = requestButtonState({ blocked: Boolean(blocked), pending: Boolean(quotePending), termsAccepted, requesting });

  if (blocked) {
    return (
      <>
        <ScreenShell>
          <StepHeader eyebrow={stepEyebrow(3)} title="Here's the breakdown." sub="Nothing is charged yet." />
          <QuoteNotice pending={quotePending} message={quoteError} onRetry={onRetryQuote} />
        </ScreenShell>
        <Sticky><PrimaryButton onClick={onRequest} disabled={button.inert}>{button.label}</PrimaryButton></Sticky>
      </>
    );
  }

  // Every component of exotiqTotalCents is shown: the server adds processing and
  // state fees into that total, and an unexplained remainder was once visible in
  // production. They come straight off the quote; mock mode has neither.
  const groups = foldFees({
    operatorName: cart.operator.name,
    operatorTotalCents: m.operatorTotalCents,
    operatorTaxCents: m.operatorTaxesCents,
    operatorTaxLabel: quote?.operatorTaxLabel,
    operatorTaxRate: quote?.operatorTaxRate,
    days: quote ? quote.rentalDays : cart.totals.days,
    dailyRateCents: quote ? quote.dailyRateCents : cart.vehicle.dailyRateCents,
    platformFeeCents: m.platformFeeCents,
    platformFeePercent: Math.round(m.platformFeeRate * 100),
    protectionTotalCents: m.protectionTotalCents,
    stateFeeCents: quote?.stateFeeCents ?? 0,
    stateFeeLabel: quote?.stateFeeLabel,
    processingFeeCents: quote?.processingFeeCents ?? 0,
    exotiqTotalCents: m.exotiqTotalCents,
  });

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow={stepEyebrow(3)} title="Here's the breakdown." sub="Nothing is charged yet." />
        <div className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-label"><div><span className="block text-faint">Dates</span>{dateLabel}</div><div><span className="block text-faint">Pickup</span>{cart.pickupTime}</div><div><span className="block text-faint">Location</span>{cart.operator.city}</div></div>
        {/* Only the Rental row is navigable: it returns to the dates step. */}
        <TwoPartyBreakdown
          groups={groups}
          onRentalClick={() => goTo(1)}
          between={onProtectionChange && <ProtectSwitch cart={cart} m={m} protectionOn={protectionOn} onProtectionChange={onProtectionChange} />}
        />
        <div className="mt-4 border-t border-line pt-4">
          <div data-money="total" className="flex items-center justify-between gap-3"><span className="text-body text-muted">Total once approved</span><span className="text-gold"><Money cents={m.grandTotalCents} large /></span></div>
          <p className="mt-2 text-body-sm leading-5 text-muted">{cart.operator.name} reviews your request, then we email you a secure payment link. Your card is only charged when you pay from that link.</p>
        </div>
        {/* Unconditional: the deposit is the operator's to collect at pickup and
            Exotiq quotes no amount, so there is no value to gate on. */}
        <DepositDisclosure operatorName={cart.operator.name} />
        <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
          <LockKeyhole size={16} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <div className="text-body font-medium">What you&apos;ll see on your statement</div>
            <p className="mt-1 text-body-sm leading-5 text-muted">Two charges: {cart.operator.name}, and <span className="text-ink">EXOTIQ.RENT</span> for Trip fees and protection.</p>
          </div>
        </div>
        {/* One collapsed policy affordance, not three. Cancellation terms and
            what protection covers were separate blocks competing for the same
            attention; neither is read at this moment, both must be available. */}
        <details className="mt-4 border-t border-line pt-4 text-body text-ink">
          <summary className="cursor-pointer font-medium">Cancellation &amp; coverage</summary>
          {/* T-6: this mirrors the platform-enforced rule (and the derived
              cancellation_policy text snapshotted on every booking) — the old
              copy claimed post-72h refunds "follow the operator's policy",
              which no code implements. */}
          <p className="mt-3 text-body-sm leading-5 text-muted">Free cancellation until 72 hours before your scheduled pickup — both charges refunded in full. Within 72 hours of pickup, the booking total is non-refundable.</p>
          {/* T-6: no specific coverage figures until the protect-plan T&C are
              finalized — the old "$0 deductible / $250K liability / roadside"
              line asserted terms no document backs. Neutral, true, and gone
              entirely when protection is declined. */}
          {protectionOn && (
            <p className="mt-3 text-body-sm leading-5 text-muted">Exotiq Protect covers damage to the vehicle during your rental period. Full coverage terms are provided before pickup.</p>
          )}
        </details>
        <label className="mt-4 flex gap-3 border-t border-line pt-4 text-body-sm leading-5 text-ink">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="control-check mt-0.5"
          />
          <span>I agree to the <span className="text-ink underline decoration-faint underline-offset-2">Rental Terms &amp; Conditions</span>.</span>
        </label>
        {/* MP-14: opt-in, unchecked, never required. Posted with the booking. */}
        {onMarketingConsentChange && renterCaptureUiEnabled() && (
          <label className="mt-3 flex gap-3 px-1 text-body-sm leading-5 text-muted">
            <input type="checkbox" checked={Boolean(cart.driver.marketingConsent)} onChange={(event) => onMarketingConsentChange(event.target.checked)} className="control-check mt-0.5" />
            <span>{CONSENT_TEXT.booking.text}</span>
          </label>
        )}
      </ScreenShell>
      <Sticky>
        {requestError && <p className="rounded-xl border border-danger/45 bg-danger/10 p-3 text-center text-body-sm leading-5 text-ink">{requestError}</p>}
        {/* The button sends a request, not a payment: nothing is charged until
            the renter pays from the link the operator's approval sends. */}
        <PrimaryButton onClick={onRequest} disabled={button.inert}>{button.label}</PrimaryButton>
      </Sticky>
    </>
  );
}

/**
 * T-12: Exotiq Protect is premium-by-default with a single decline toggle (no
 * tier menu). Toggling recomputes the cart; quoteKey includes the tier, so the
 * flow blocks on a fresh server quote before the renter can commit either way.
 * The shipped switch, markup and copy unchanged (MP-26 compares it with the
 * base); it sits between the operator's charge and Drive Exotiq's.
 */
function ProtectSwitch({
  cart,
  m,
  protectionOn,
  onProtectionChange,
}: {
  cart: BookingCart;
  m: PublicQuote | BookingTotals;
  protectionOn: boolean;
  onProtectionChange: (tier: ProtectChoice) => void;
}) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-body font-medium text-ink">Exotiq Protect</div>
          <p className="mt-1 text-body-sm leading-5 text-muted">
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
          className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${protectionOn ? 'bg-gold' : 'bg-line'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-ink shadow-[0_1px_2px_rgba(0,0,0,.4)] transition-all ${protectionOn ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
}
