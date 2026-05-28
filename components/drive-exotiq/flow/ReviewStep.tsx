'use client';

import { Money, PrimaryButton } from '../BookingChrome';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { Breakdown, ScreenShell, StepHeader, Sticky } from './shared';

function formatDateRange(start: string, end: string) {
  const startDay = Number(start.split('-')[2]);
  const endDay = Number(end.split('-')[2]);
  return `Jun ${startDay}–${endDay}`;
}

export function ReviewStep({ cart, goTo, next }: { cart: BookingCart; goTo: (step: number) => void; next: () => void }) {
  const dateLabel = formatDateRange(cart.dates.start, cart.dates.end);
  const platformPercent = Math.round(cart.totals.platformFeeRate * 100);

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 06" title="Review the split." sub="Operator charges, Exotiq platform fee, and Exotiq protection are broken out before the single checkout charge." />
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-center text-[11px]"><div><span className="block text-[#5C6272]">Dates</span>{dateLabel}</div><div><span className="block text-[#5C6272]">Pickup</span>{cart.pickupTime}</div><div><span className="block text-[#5C6272]">Location</span>{cart.operator.city}</div></div>
        <Breakdown title="Operator" note={`Charge from ${cart.operator.name}`} rows={[['Rental', `${cart.totals.days} × ${formatMoney(cart.vehicle.dailyRateCents)}`, cart.totals.rentalSubtotalCents, () => goTo(1)], ['Extras', `${cart.extras.length} selected`, cart.totals.extrasSubtotalCents, () => goTo(3)], ['Taxes & fees', 'Operator tax estimate', cart.totals.operatorTaxesCents]]} total={cart.totals.operatorTotalCents} />
        <Breakdown title="Exotiq.Rent" note="Single Stripe Checkout charge; operator share transfers automatically" rows={[[`Platform fee (${platformPercent}%)`, `On ${formatMoney(cart.totals.platformFeeBaseCents)} booking amount; deposit excluded`, cart.totals.platformFeeCents], ['Protection plan', cart.protection === 'decline' ? 'Declined — hold required later' : `${cart.protection} · ${cart.totals.days} days`, cart.totals.protectionTotalCents, () => goTo(4)]]} total={cart.totals.exotiqTotalCents} />
        <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4"><div className="flex items-center justify-between"><span className="text-sm text-[#9BA1B0]">Total due today</span><Money cents={cart.totals.grandTotalCents} large /></div></div>
        <DepositHoldCard amountCents={cart.totals.depositHoldCents} />
        <details className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm text-[#F0F2F5]">
          <summary className="cursor-pointer font-medium">Free cancellation</summary>
          <p className="mt-3 text-xs leading-5 text-[#9BA1B0]">Cancel up to 72 hours before pickup for a full refund.</p>
          <div className="mt-3 space-y-1 text-xs leading-5 text-[#9BA1B0]">
            <div>After the free cancellation window:</div>
            <div>Platform fee ({platformPercent}%): non-refundable</div>
            <div>Protection plan: non-refundable</div>
            <div>Operator rental: per operator&apos;s cancellation policy</div>
          </div>
        </details>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next}>Proceed to payment</PrimaryButton></Sticky>
    </>
  );
}

function DepositHoldCard({ amountCents }: { amountCents: number }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4 text-sm">
      <div className="flex items-center justify-between gap-3"><span className="text-[#9BA1B0]">Security deposit hold</span><Money cents={amountCents} /></div>
      <p className="mt-2 text-xs leading-5 text-[#5C6272]">Authorization only — not charged.</p>
      <p className="text-xs leading-5 text-[#5C6272]">Released within 48h of return if no damage.</p>
    </div>
  );
}
