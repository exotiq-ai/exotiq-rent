import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LockKeyhole, Phone, Sparkles } from 'lucide-react';
import { getBookingConfirmation, createBookingCart } from '@/domain/booking/service';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import { HTitle, Money, PhoneViewport } from './BookingChrome';
import { IdentityVerificationCard } from './IdentityVerificationCard';

export async function ConfirmationScreen({ bookingRef, accessToken }: { bookingRef: string; accessToken?: string }) {
  const lookup = await getBookingConfirmation(bookingRef, accessToken);
  if (!lookup) notFound();

  // D4: a booking ref without its access token shows existence + status only.
  if ('restricted' in lookup) {
    return (
      <PhoneViewport step={8} className="font-[var(--font-drive-inter)]">
        <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><LockKeyhole size={24} /></div>
          <HTitle className="mt-5 text-[24px]">Booking {lookup.bookingRef}</HTitle>
          <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">Status: {lookup.status.replace(/_/g, ' ')}. To view the full confirmation, use the secure link from your booking — it carries your access key.</p>
        </section>
      </PhoneViewport>
    );
  }

  const confirmation = lookup;
  const live = confirmation.live;
  const cart = createBookingCart({ operator: confirmation.team, vehicle: confirmation.vehicle });
  const platformPercent = Math.round(cart.totals.platformFeeRate * 100);
  const dateLabel = live
    ? formatRangeLabel(live.startAt.slice(0, 10), live.endAt.slice(0, 10))
    : formatRangeLabel(cart.dates.start, cart.dates.end);
  const totalLabel = live ? formatMoney(live.totalCents) : formatMoney(cart.totals.grandTotalCents);

  return (
    <PhoneViewport step={8} className="font-[var(--font-drive-inter)]">
      <section className="flex-1 overflow-y-auto px-4 pb-8 pt-2 [scrollbar-width:none]">
        <div className="relative overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922]">
          <div className="relative h-56">
            <Image src={cart.vehicle.heroImage} alt={cart.vehicle.name} fill sizes="393px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#161922]" />
            <div className="absolute right-3 top-3 rounded-full bg-[#C8A664]/10 px-3 py-1 text-xs text-[#C8A664]"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#C8A664]" />Reserved</div>
          </div>
          <div className="p-4"><HTitle>Your {cart.vehicle.make} is reserved.</HTitle><p className="mt-2 text-sm text-[#9BA1B0]">Booking {confirmation.bookingRef}</p></div>
        </div>
        <IdentityVerificationCard bookingRef={confirmation.bookingRef} initialStatus={live && live.status !== 'pending_documents' ? 'verified' : undefined} />
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm"><Detail label="Dates" value={dateLabel} /><Detail label="Pickup" value={cart.pickupTime} /><Detail label="Location" value={live ? `${cart.operator.city}, ${cart.operator.state}` : cart.vehicle.pickupLocation.address} /><Detail label="Total" value={totalLabel} /></div>
        {!live && (
          <>
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <div className="mb-3 text-sm font-medium">Charges</div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Operator rental charge</span><span className="text-xs text-[#C8A664]">Charged by {cart.operator.name}</span></span><Money cents={cart.totals.operatorTotalCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Exotiq booking fee ({platformPercent}%)</span><span className="text-xs text-[#C8A664]">On rental only; extras & deposit excluded</span></span><Money cents={cart.totals.platformFeeCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Exotiq protection plan</span><span className="text-xs text-[#C8A664]">Included in EXOTIQ.RENT charge</span></span><Money cents={cart.totals.protectionTotalCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm font-medium"><span>Exotiq total</span><Money cents={cart.totals.exotiqTotalCents} /></div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><LockKeyhole size={16} className="text-[#C8A664]" />Security deposit</div>
              <div className="flex justify-between text-sm"><span className="text-[#9BA1B0]">Authorized on your card</span><Money cents={cart.totals.depositHoldCents} /></div>
              <p className="mt-2 text-xs leading-5 text-[#5C6272]">Released within 48h of return if no damage.</p>
            </div>
          </>
        )}
        {live && (
          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <div className="mb-1 text-sm font-medium">Operator rental total</div>
            <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span className="text-[#9BA1B0]">Charged by {cart.operator.name}</span><Money cents={live.totalCents} /></div>
            <p className="text-xs leading-5 text-[#5C6272]">Exotiq booking fee and protection are itemized at payment (payment wiring arrives with the money milestone).</p>
          </div>
        )}
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A664]/10 text-[#C8A664]">DE</div><div className="flex-1"><div className="text-sm font-medium">{cart.operator.name}</div><div className="text-xs text-[#9BA1B0]">Will reach out before pickup</div></div><a href={`tel:${cart.operator.phone}`} className="rounded-full border border-[#C8A664]/30 p-2 text-[#C8A664]" aria-label="Call operator"><Phone size={16} /></a></div></div>
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-[#C8A664]" />What happens next</div>{['Verify your identity above to confirm the booking.', 'Operator confirms final handoff details.', 'You receive pickup reminders before the rental.', 'Security deposit hold is placed on your card after your identity is verified.'].map((item, index) => <div key={item} className="flex gap-3 border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]"><span className="text-[#C8A664]">0{index + 1}</span>{item}</div>)}</div>
        <button type="button" className="mt-4 w-full rounded-xl bg-[#C8A664] px-5 py-4 text-sm font-semibold text-[#1A1308]">Share your Exotiq</button>
        <button type="button" className="mt-3 w-full rounded-xl border border-[#2A2E3A] px-5 py-4 text-sm font-semibold text-[#F0F2F5]">Add to calendar</button>
      </section>
    </PhoneViewport>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6272]">{label}</div><div className="mt-1 text-[#F0F2F5]">{value}</div></div>;
}
