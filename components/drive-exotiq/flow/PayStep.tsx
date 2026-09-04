'use client';

import { LockKeyhole } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import type { PublicQuote } from '@/domain/booking/publicContracts';
import { DepositDisclosure, QuoteNotice, ScreenShell, StepHeader, Sticky } from './shared';

export function PayStep({
  cart,
  onPay,
  paying = false,
  payError,
  quote,
  quotePending,
  quoteError,
  onRetryQuote,
  blocked,
}: {
  cart: BookingCart;
  onPay: () => void;
  paying?: boolean;
  payError?: string;
  /** Server figures; when present these are what the renter is agreeing to. */
  quote?: PublicQuote | null;
  quotePending?: boolean;
  quoteError?: string;
  onRetryQuote?: () => void;
  /** True when live pricing is unconfirmed — the renter must not reserve. */
  blocked?: boolean;
}) {
  // Server quote governs; the client engine is the mock-mode fallback only.
  const m = quote ?? cart.totals;
  const platformPercent = Math.round(m.platformFeeRate * 100);
  // The quote has no fee-base column; per D1/D9 the base IS the rental
  // subtotal, which is what the copy states.
  const feeBaseCents = quote ? quote.rentalSubtotalCents : cart.totals.platformFeeBaseCents;

  if (blocked) {
    return (
      <>
        <ScreenShell>
          <StepHeader eyebrow="Step 05" title="Reserve your dates." sub="Nothing is charged yet." />
          <QuoteNotice pending={quotePending} message={quoteError} onRetry={onRetryQuote} />
        </ScreenShell>
        <Sticky><PrimaryButton onClick={onPay} disabled>{quotePending ? 'Getting final pricing…' : 'Request this booking'}</PrimaryButton></Sticky>
      </>
    );
  }

  return (
    <>
      <ScreenShell>
        {/* Nothing is charged at this step: Reserve creates the request, the
            operator reviews it, and only then do we email a payment link. The
            copy has to say that plainly — "Final payment / due today" read as a
            charge that never happened. */}
        <StepHeader eyebrow="Step 05" title="Reserve your dates." sub="Nothing is charged yet." />
        <div className="rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
          <div className="text-xs uppercase tracking-[0.22em] text-[#848A9A]">Total once approved</div>
          <div className="mt-2"><Money cents={m.grandTotalCents} large /></div>
          <p className="mt-2 text-xs leading-5 text-[#9BA1B0]">{cart.operator.name} reviews your request, then we email you a secure payment link. Your card is only charged when you pay from that link.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm">
          {/* Tax rides INSIDE the operator charge (T-11) — itemised so the
              operator row plus the tax row sum to what the statement shows. */}
          {m.operatorTaxesCents > 0 ? (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-[#9BA1B0]">Operator rental</span>
                <Money cents={m.operatorTotalCents - m.operatorTaxesCents} />
              </div>
              <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
                <span className="text-[#9BA1B0]">{quote?.operatorTaxLabel ?? 'Tax'}{quote?.operatorTaxRate != null ? ` (${quote.operatorTaxRate}%)` : ''}</span>
                <Money cents={m.operatorTaxesCents} />
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-3">
              <span className="text-[#9BA1B0]">Operator rental charge</span>
              <Money cents={m.operatorTotalCents} />
            </div>
          )}
          <div className="mt-2 text-xs leading-5 text-[#848A9A]">Charged by {cart.operator.name} — appears as its own line on your statement.</div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
            <span className="text-[#9BA1B0]">Trip Fees ({platformPercent}%)</span>
            <Money cents={m.platformFeeCents} />
          </div>
          <div className="mt-1 text-xs leading-5 text-[#848A9A]">Calculated on the {formatMoney(feeBaseCents)} rental only.</div>
          {/* T-12: protection is declinable — a $0 row for a declined booking
              reads as a glitch, so the row exists only when protection does. */}
          {m.protectionTotalCents > 0 ? (
            <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
              <span className="text-[#9BA1B0]">Exotiq Protect (premium)</span>
              <Money cents={m.protectionTotalCents} />
            </div>
          ) : null}
          {/* Itemise everything the server folded into exotiqTotalCents —
              otherwise the rows and the total disagree. */}
          {quote?.stateFeeCents ? (
            <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
              <span className="text-[#9BA1B0]">{quote.stateFeeLabel ?? 'State rental fee'}</span>
              <Money cents={quote.stateFeeCents} />
            </div>
          ) : null}
          {quote?.processingFeeCents ? (
            <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
              <span className="text-[#9BA1B0]">Processing fees</span>
              <Money cents={quote.processingFeeCents} />
            </div>
          ) : null}
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3 font-medium text-[#F0F2F5]">
            <span>Exotiq total</span>
            <Money cents={m.exotiqTotalCents} />
          </div>
        </div>

        {/* Unconditional: the deposit is the operator's to collect at pickup and
            Exotiq quotes no amount, so there is no value to gate on. */}
        <DepositDisclosure operatorName={cart.operator.name} />

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><LockKeyhole size={16} /></div>
            <div>
              <div className="text-sm font-medium">What you&apos;ll see on your statement</div>
              <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Two charges: {cart.operator.name}, and <span className="text-[#F0F2F5]">EXOTIQ.RENT</span> for Trip Fees and protection.</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[#9BA1B0]">Free cancellation up to 72 hours before pickup.</p>
      </ScreenShell>
      <Sticky>
        {payError && <p className="rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-3 text-center text-xs leading-5 text-[#F0F2F5]">{payError}</p>}
        {/* "Reserve for $X" implied an immediate charge of $X. It requests the
            booking; payment is a later, separate step. */}
        <PrimaryButton onClick={onPay} disabled={paying}>{paying ? 'Sending request…' : 'Request this booking'}</PrimaryButton>
      </Sticky>
    </>
  );
}
