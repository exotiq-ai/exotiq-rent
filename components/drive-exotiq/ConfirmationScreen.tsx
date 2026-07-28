import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LockKeyhole, Phone, Sparkles } from 'lucide-react';
import { getBookingConfirmation, createBookingCart } from '@/domain/booking/service';
import { formatRangeLabel } from '@/domain/booking/dates';
import { formatMoney } from '@/domain/booking/totals';
import { HTitle, Money, PhoneViewport } from './BookingChrome';
import { CancelBookingCard } from './CancelBookingCard';
import { ConfirmationActions } from './ConfirmationActions';
import { IdentityVerificationCard } from './IdentityVerificationCard';
import { PaymentCard } from './PaymentCard';

export async function ConfirmationScreen({
  bookingRef,
  accessToken,
  payment,
}: {
  bookingRef: string;
  accessToken?: string;
  /** `?payment=` from rent-checkout's success/cancel URLs. */
  payment?: string;
}) {
  const lookup = await getBookingConfirmation(bookingRef, accessToken);
  if (!lookup) notFound();

  // D4: a booking ref without its access token shows existence + status only.
  if ('restricted' in lookup) {
    return (
      <PhoneViewport step={6} className="font-[var(--font-drive-inter)]">
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

  // M6c: terminal marketplace states get a banner, not the reservation UI.
  const TERMINAL: Record<string, { badge: string; title: string; note: string }> = {
    cancelled: { badge: 'Cancelled', title: 'This booking was cancelled.', note: 'The dates have been released. Book again any time.' },
    refunded: { badge: 'Refunded', title: 'Cancelled & refunded in full.', note: 'Both charges were refunded — allow 5–10 business days to appear on your statement.' },
    declined: { badge: 'Declined', title: 'The operator declined this booking.', note: 'Any captured payment is refunded in full automatically.' },
    payment_expired: { badge: 'Expired', title: 'The payment window closed.', note: 'The dates were released. Book again any time — approval is usually faster the second time.' },
  };
  const terminal = live ? TERMINAL[live.status] : undefined;
  const returnNotice = resolveReturnNotice({ payment });
  const cancellable = Boolean(
    live && accessToken && !terminal && live.platformFeeCents !== undefined &&
    ['requested', 'pending_documents', 'pending_payment', 'confirmed'].includes(live.status),
  );

  return (
    <PhoneViewport step={6} className="font-[var(--font-drive-inter)]">
      <section className="flex-1 overflow-y-auto px-4 pb-8 pt-2 [scrollbar-width:none]">
        {returnNotice && <ReturnNotice {...returnNotice} />}
        <div className="relative overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922]">
          <div className="relative h-56">
            {cart.vehicle.heroImage
              ? <Image src={cart.vehicle.heroImage} alt={cart.vehicle.name} fill sizes="393px" className="object-cover" />
              : <div className="absolute inset-0 bg-gradient-to-br from-[#1E2230] to-[#0D0F14]" />}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#161922]" />
            {/* One-time celebration: a single champagne-gold sheen across the car. */}
            <div aria-hidden className="animate-gold-sheen pointer-events-none absolute inset-y-0 w-1/3" />
            <div className={`animate-reserve-pop absolute right-3 top-3 rounded-full px-3 py-1 text-xs ${terminal ? 'bg-[#2A2E3A]/60 text-[#9BA1B0]' : 'bg-[#C8A664]/10 text-[#C8A664]'}`}>{!terminal && <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#C8A664]" />}{terminal ? terminal.badge : 'Reserved'}</div>
          </div>
          <div className="p-4"><HTitle>{terminal ? terminal.title : `Your ${cart.vehicle.make} is reserved.`}</HTitle><p className="mt-2 text-sm text-[#9BA1B0]">Booking {confirmation.bookingRef}</p></div>
        </div>
        {terminal && (
          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm leading-6 text-[#9BA1B0]">{terminal.note}</div>
        )}
        {!terminal && (
          // Identity state is NOT inferable from booking status: an operator
          // approving or editing a booking moves it out of pending_documents
          // without any verification having happened, and claiming "identity
          // verified" then is a false assurance to the renter and the operator.
          // The card resolves the truth from the identity endpoints instead
          // (an already-verified email returns verified+reused on first tap).
          // TODO(backend): expose identity_verified on public_booking_by_ref so
          // this can render verified without requiring a tap.
          <IdentityVerificationCard bookingRef={confirmation.bookingRef} confirmationToken={accessToken} />
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm"><Detail label="Dates" value={dateLabel} /><Detail label="Pickup" value={cart.pickupTime} /><Detail label="Location" value={live ? `${cart.operator.city}, ${cart.operator.state}` : cart.vehicle.pickupLocation.address} /><Detail label="Total" value={totalLabel} /></div>
        {!live && (
          <>
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <div className="mb-3 text-sm font-medium">Charges</div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Operator rental charge</span><span className="text-xs text-[#C8A664]">Charged by {cart.operator.name}</span></span><Money cents={cart.totals.operatorTotalCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Trip Fees ({platformPercent}%)</span><span className="text-xs text-[#C8A664]">Calculated on the rental only</span></span><Money cents={cart.totals.platformFeeCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Protection (included)</span><span className="text-xs text-[#C8A664]">Included in EXOTIQ.RENT charge</span></span><Money cents={cart.totals.protectionTotalCents} /></div>
              <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm font-medium"><span>Exotiq total</span><Money cents={cart.totals.exotiqTotalCents} /></div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><LockKeyhole size={16} className="text-[#C8A664]" />Damage deposit at pickup</div>
              <p className="text-xs leading-5 text-[#848A9A]">{cart.operator.name} collects a refundable damage deposit at pickup. Amount and accepted payment methods vary by operator — they&apos;ll confirm before handoff.</p>
              <p className="mt-1 text-xs leading-5 text-[#848A9A]">Not included in the charges above.</p>
            </div>
          </>
        )}
        {live && live.status === 'pending_payment' && live.paymentDueAt && accessToken && (
          <PaymentCard
            bookingRef={confirmation.bookingRef}
            accessToken={accessToken}
            dueAtIso={live.paymentDueAt}
            rentalCents={live.totalCents}
            platformFeeCents={live.platformFeeCents ?? 0}
            protectionTotalCents={live.protectionTotalCents ?? 0}
            operatorName={cart.operator.name}
          />
        )}
        {live && live.paidAt && !terminal && (
          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <div className="mb-1 text-sm font-medium">Paid — your receipt</div>
            <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block text-[#9BA1B0]">{cart.operator.name} rental</span><span className="text-xs text-[#848A9A]">Appears as {cart.operator.name} on your statement</span></span><Money cents={live.totalCents} /></div>
            <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block text-[#9BA1B0]">Trip Fees + protection</span><span className="text-xs text-[#848A9A]">Appears as EXOTIQ RENT</span></span><Money cents={(live.platformFeeCents ?? 0) + (live.protectionTotalCents ?? 0)} /></div>
            <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm font-medium"><span>Total paid</span><Money cents={live.totalCents + (live.platformFeeCents ?? 0) + (live.protectionTotalCents ?? 0)} /></div>
          </div>
        )}
        {live && !terminal && !live.paidAt && live.status !== 'pending_payment' && (
          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <div className="mb-1 text-sm font-medium">Operator rental total</div>
            <div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span className="text-[#9BA1B0]">Charged by {cart.operator.name}</span><Money cents={live.totalCents} /></div>
            <p className="text-xs leading-5 text-[#848A9A]">Trip Fees and protection are itemized at payment, once the operator approves.</p>
          </div>
        )}
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A664]/10 text-[#C8A664]">DE</div><div className="flex-1"><div className="text-sm font-medium">{cart.operator.name}</div><div className="text-xs text-[#9BA1B0]">{terminal ? (cart.operator.phone ? 'Questions about this booking? Call any time.' : 'Questions about this booking? Reply to your confirmation email.') : 'Will reach out before pickup'}</div></div>{cart.operator.phone && <a href={`tel:${cart.operator.phone}`} className="rounded-full border border-[#C8A664]/30 p-2 text-[#C8A664]" aria-label="Call operator"><Phone size={16} /></a>}</div></div>
        {!terminal && (
          <>
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-[#C8A664]" />What happens next</div>{/* The deposit step describes an in-person handoff, not a link: Exotiq
                takes no part in the deposit, so there is nothing for us to email and
                no amount for us to quote. */}
              {['Verify your identity above to confirm the booking.', 'Operator confirms final handoff details.', 'You receive pickup reminders before the rental.', `${cart.operator.name} collects a refundable damage deposit when you pick up the car.`].map((item, index) => <div key={item} className="flex gap-3 border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]"><span className="text-[#C8A664]">0{index + 1}</span>{item}</div>)}</div>
            <ConfirmationActions
              bookingRef={confirmation.bookingRef}
              vehicleName={cart.vehicle.name}
              teamSlug={cart.operator.slug}
              vehicleSlug={cart.vehicle.slug}
              startDate={live ? live.startAt.slice(0, 10) : cart.dates.start}
              endDate={live ? live.endAt.slice(0, 10) : cart.dates.end}
              pickupTime={cart.pickupTime}
              location={live ? `${cart.operator.city}, ${cart.operator.state}` : cart.vehicle.pickupLocation.address}
            />
          </>
        )}
        {cancellable && live && accessToken && (
          <CancelBookingCard
            bookingRef={confirmation.bookingRef}
            accessToken={accessToken}
            pickupAtIso={live.startAt}
            paid={Boolean(live.paidAt)}
          />
        )}
        {!terminal && (
          <p className="mt-5 rounded-xl border border-dashed border-[#2A2E3A] p-3 text-center text-[11.5px] leading-5 text-[#848A9A]">Exotiq never stores your ID — identity documents are processed securely by Stripe, our verification partner. Verified status lasts until your document expires.</p>
        )}
      </section>
    </PhoneViewport>
  );
}

type ReturnNoticeProps = { tone: 'good' | 'warn'; title: string; body: string };

/**
 * Acknowledges a renter coming back from Stripe Checkout. Without it the renter
 * completes a Stripe screen, returns to a visually identical page, and has no
 * idea whether it worked — which generates support contacts.
 *
 * `payment=success` deliberately does NOT claim the booking is confirmed:
 * Stripe redirects on its own schedule and the webhook that promotes the
 * booking may not have landed yet, so a "confirmed!" banner would contradict a
 * status still showing pending_payment two inches below it.
 *
 * The `?deposit=` branches are gone with the 2026-07-26 decision — Exotiq no
 * longer sends renters to any deposit-related Stripe page, so there is no such
 * return to acknowledge.
 */
function resolveReturnNotice({ payment }: { payment?: string }): ReturnNoticeProps | null {
  if (payment === 'success') {
    return {
      tone: 'good',
      title: 'Payment received',
      body: "We're confirming it with your bank. This page updates on its own — no need to pay again.",
    };
  }
  if (payment === 'cancelled') {
    return {
      tone: 'warn',
      title: 'Payment not completed',
      body: 'Your dates are still held. You can pay from this page any time before the deadline below.',
    };
  }
  return null;
}

function ReturnNotice({ tone, title, body }: ReturnNoticeProps) {
  const good = tone === 'good';
  return (
    <div
      role="status"
      className={`mb-3 rounded-xl border p-4 ${good ? 'border-[#C8A664] bg-[#14130F]' : 'border-[#FFB84D]/45 bg-[#FFB84D]/10'}`}
    >
      <div className={`text-sm font-medium ${good ? 'text-[#C8A664]' : 'text-[#FFB84D]'}`}>{title}</div>
      <p className="mt-1 text-xs leading-5 text-[#F0F2F5]">{body}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-[0.2em] text-[#848A9A]">{label}</div><div className="mt-1 text-[#F0F2F5]">{value}</div></div>;
}
