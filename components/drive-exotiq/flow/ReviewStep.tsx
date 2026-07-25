'use client';

import { Money, PrimaryButton } from '../BookingChrome';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { Breakdown, ScreenShell, StepHeader, Sticky } from './shared';

export function ReviewStep({ cart, goTo, next }: { cart: BookingCart; goTo: (step: number) => void; next: () => void }) {
  const dateLabel = formatRangeLabel(cart.dates.start, cart.dates.end);
  const platformPercent = Math.round(cart.totals.platformFeeRate * 100);

  // Only show operator line-items that carry a real amount — extras and the
  // operator tax are zero in the live flow, and a "$0" line reads as noise.
  const operatorRows: [string, string, number, (() => void)?][] = [
    ['Rental', `${cart.totals.days} × ${formatMoney(cart.vehicle.dailyRateCents)}`, cart.totals.rentalSubtotalCents, () => goTo(1)],
  ];
  if (cart.totals.extrasSubtotalCents > 0) operatorRows.push(['Extras', `${cart.extras.length} selected`, cart.totals.extrasSubtotalCents, () => goTo(3)]);
  if (cart.totals.operatorTaxesCents > 0) operatorRows.push(['Taxes & fees', 'Operator tax estimate', cart.totals.operatorTaxesCents]);

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 06" title="Here's the breakdown." sub="Review your details before payment." />
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-center text-[11px]"><div><span className="block text-[#848A9A]">Dates</span>{dateLabel}</div><div><span className="block text-[#848A9A]">Pickup</span>{cart.pickupTime}</div><div><span className="block text-[#848A9A]">Location</span>{cart.operator.city}</div></div>
        <Breakdown title="Operator" note={`Charge from ${cart.operator.name}`} rows={operatorRows} total={cart.totals.operatorTotalCents} />
        <Breakdown title="Exotiq.Rent" note="Booking fee + protection, charged separately by EXOTIQ.RENT" rows={[[`Booking fee (${platformPercent}%)`, 'Platform fee', cart.totals.platformFeeCents], ['Protection plan', cart.protection === 'decline' ? 'Declined — hold required later' : `${cart.protection} · ${cart.totals.days} days`, cart.totals.protectionTotalCents, () => goTo(4)]]} total={cart.totals.exotiqTotalCents} />
        <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#14130F] p-4"><div className="flex items-center justify-between"><span className="text-sm text-[#9BA1B0]">Total due today</span><Money cents={cart.totals.grandTotalCents} large /></div></div>
        <DepositHoldCard amountCents={cart.totals.depositHoldCents} />
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

function DepositHoldCard({ amountCents }: { amountCents: number }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4 text-sm">
      <div className="flex items-center justify-between gap-3"><span className="text-[#9BA1B0]">Security deposit hold</span><Money cents={amountCents} /></div>
      <p className="mt-2 text-xs leading-5 text-[#848A9A]">Authorization only — not charged.</p>
      <p className="text-xs leading-5 text-[#848A9A]">Released within 48h of return if no damage.</p>
    </div>
  );
}
