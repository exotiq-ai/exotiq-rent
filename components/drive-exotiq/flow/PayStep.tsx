'use client';

import { Check, CreditCard, WalletCards } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky } from './shared';

export function PayStep({ cart, onPay }: { cart: BookingCart; onPay: () => void }) {
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 07" title="Pay securely" sub="Mocked payment today · Stripe boundary next." />
      <div className="rounded-xl border border-[#C8A664] bg-[#C8A664]/10 p-4"><div className="text-xs uppercase tracking-[0.22em] text-[#5C6272]">Total due today</div><div className="mt-2"><Money cents={cart.totals.grandTotalCents} large /></div></div>
      <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm">
        <div className="flex justify-between"><span className="text-[#9BA1B0]">Operator charge</span><Money cents={cart.totals.operatorTotalCents} /></div>
        <div className="mt-3 flex justify-between border-t border-[#2A2E3A] pt-3"><span className="text-[#9BA1B0]">Exotiq Protect charge</span><Money cents={cart.totals.protectionTotalCents} /></div>
      </div>
      <button type="button" onClick={onPay} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white"><WalletCards size={18} /> Apple Pay mock</button>
      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#5C6272]"><span className="h-px flex-1 bg-[#2A2E3A]" />Tokenized card mock<span className="h-px flex-1 bg-[#2A2E3A]" /></div>
      <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><CreditCard size={18} /></div><div className="flex-1"><div className="text-sm font-medium">Mock payment method</div><div className="mt-1 text-xs text-[#9BA1B0]">Tokenized test method ready for future Stripe Elements integration.</div></div><Check size={16} className="text-[#C8A664]" /></div></div>
      <p className="mt-4 text-center text-xs text-[#5C6272]">No raw card data is collected in this scaffold.</p>
      <Sticky><PrimaryButton onClick={onPay}>Pay {formatMoney(cart.totals.grandTotalCents)}</PrimaryButton></Sticky>
    </ScreenShell>
  );
}
