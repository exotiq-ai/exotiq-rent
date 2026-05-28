'use client';

import { CreditCard, LockKeyhole, WalletCards } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky } from './shared';

export function PayStep({ cart, onPay }: { cart: BookingCart; onPay: () => void }) {
  const platformPercent = Math.round(cart.totals.platformFeeRate * 100);

  return (
    <>
      <ScreenShell>
        <StepHeader
          eyebrow="Step 07"
          title="Final payment."
          sub="One secure Stripe Checkout collects the full booking amount; the operator share transfers automatically."
        />
        <div className="rounded-xl border border-[#C8A664] bg-[#14130F] p-4 shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]">
          <div className="text-xs uppercase tracking-[0.22em] text-[#5C6272]">Estimated total due today</div>
          <div className="mt-2"><Money cents={cart.totals.grandTotalCents} large /></div>
          <p className="mt-2 text-xs leading-5 text-[#9BA1B0]">Security deposits or future authorization holds are not included in the platform-fee base.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[#9BA1B0]">Operator rental charge</span>
            <Money cents={cart.totals.operatorTotalCents} />
          </div>
          <div className="mt-2 text-xs leading-5 text-[#5C6272]">Included in the single EXOTIQ.RENT checkout; operator share transfers automatically.</div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
            <span className="text-[#9BA1B0]">Exotiq platform fee ({platformPercent}%)</span>
            <Money cents={cart.totals.platformFeeCents} />
          </div>
          <div className="mt-1 text-xs leading-5 text-[#5C6272]">Calculated on {formatMoney(cart.totals.platformFeeBaseCents)} booking amount, excluding deposits.</div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3">
            <span className="text-[#9BA1B0]">Exotiq protection plan</span>
            <Money cents={cart.totals.protectionTotalCents} />
          </div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[#2A2E3A] pt-3 font-medium text-[#F0F2F5]">
            <span>Exotiq total</span>
            <Money cents={cart.totals.exotiqTotalCents} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-[#9BA1B0]">Security deposit hold</span><Money cents={cart.totals.depositHoldCents} /></div>
          <p className="mt-2 text-xs leading-5 text-[#5C6272]">Authorization only — not charged. Released within 48h of return if no damage.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><LockKeyhole size={18} /></div>
            <div>
              <div className="text-sm font-medium">Stripe statement descriptor</div>
              <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Your card will be charged once by <span className="text-[#F0F2F5]">EXOTIQ.RENT</span> for the full booking amount. The operator&apos;s share is transferred automatically.</p>
            </div>
          </div>
        </div>

        <button type="button" onClick={onPay} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white"><WalletCards size={18} /> Continue with Stripe checkout</button>
        <p className="mt-3 text-center text-xs text-[#9BA1B0]">Free cancellation up to 72 hours before pickup.</p>
        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#5C6272]"><span className="h-px flex-1 bg-[#2A2E3A]" />Preview payment method<span className="h-px flex-1 bg-[#2A2E3A]" /></div>
        <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><CreditCard size={18} /></div><div className="flex-1"><div className="text-sm font-medium">Stripe Checkout placeholder</div><div className="mt-1 text-xs text-[#9BA1B0]">Backend will return a hosted checkout URL; no card data enters app state.</div></div></div></div>
        <p className="mt-4 text-center text-xs text-[#5C6272]">No raw card data is collected in this preview.</p>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={onPay}>Reserve for {formatMoney(cart.totals.grandTotalCents)}</PrimaryButton></Sticky>
    </>
  );
}
