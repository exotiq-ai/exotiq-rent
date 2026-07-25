'use client';

import { LockKeyhole } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky } from './shared';

export function PayStep({ cart, onPay, paying = false, payError }: { cart: BookingCart; onPay: () => void; paying?: boolean; payError?: string }) {
  const platformPercent = Math.round(cart.totals.platformFeeRate * 100);

  return (
    <>
      <ScreenShell>
        {/* Nothing is charged at this step: Reserve creates the request, the
            operator reviews it, and only then do we email a payment link. The
            copy has to say that plainly — "Final payment / due today" read as a
            charge that never happened. */}
        <StepHeader eyebrow="Step 07" title="Reserve your dates." sub="Nothing is charged yet." />
        <div className="rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
          <div className="text-xs uppercase tracking-[0.22em] text-[#848A9A]">Total once approved</div>
          <div className="mt-2"><Money cents={cart.totals.grandTotalCents} large /></div>
          <p className="mt-2 text-xs leading-5 text-[#9BA1B0]">{cart.operator.name} reviews your request, then we email you a secure payment link. Your card is only charged when you pay from that link.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[#9BA1B0]">Operator rental charge</span>
            <Money cents={cart.totals.operatorTotalCents} />
          </div>
          <div className="mt-2 text-xs leading-5 text-[#848A9A]">Charged by {cart.operator.name} — appears as its own line on your statement.</div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
            <span className="text-[#9BA1B0]">Exotiq booking fee ({platformPercent}%)</span>
            <Money cents={cart.totals.platformFeeCents} />
          </div>
          <div className="mt-1 text-xs leading-5 text-[#848A9A]">Calculated on the {formatMoney(cart.totals.platformFeeBaseCents)} rental only; extras and deposits excluded.</div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
            <span className="text-[#9BA1B0]">Exotiq protection plan</span>
            <Money cents={cart.totals.protectionTotalCents} />
          </div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3 font-medium text-[#F0F2F5]">
            <span>Exotiq total</span>
            <Money cents={cart.totals.exotiqTotalCents} />
          </div>
        </div>

        {/* Only disclose a deposit once there is an amount — "hold: $0" reads as
            a bug. The backend resolves the real amount (tenant default /
            per-vehicle override) as part of the deposit-hold work. */}
        {cart.totals.depositHoldCents > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-[#9BA1B0]">Security deposit hold</span><Money cents={cart.totals.depositHoldCents} /></div>
            <p className="mt-2 text-xs leading-5 text-[#848A9A]">Authorization only — not charged. Released within 48h of return if no damage.</p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><LockKeyhole size={18} /></div>
            <div>
              <div className="text-sm font-medium">What you&apos;ll see on your statement</div>
              <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Two charges: the operator&apos;s rental charge, and an <span className="text-[#F0F2F5]">EXOTIQ.RENT</span> charge for the booking fee and protection.</p>
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
