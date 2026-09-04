'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookingChrome, Money } from './BookingChrome';
import { createBookingCart, createRenterBooking } from '@/domain/booking/service';
import { getDataMode } from '@/domain/booking/config';
import { track } from '@/components/analytics/posthog';
import { loadQuote, quoteKey, quotingEnabled, QuoteUnavailableError, type QuoteState } from '@/domain/booking/quote';
import { addDays } from '@/domain/booking/dates';
import { daysBetween } from '@/domain/booking/marketplaceQuery';
import { localTodayIso, rangeIsBookable } from '@/domain/booking/availability';
import { recomputeBookingCart } from './flow/state';
import type { BookingCart, Operator, Vehicle } from '@/domain/booking/types';
import { DatesStep } from './flow/DatesStep';
import { DriverStep } from './flow/DriverStep';
import { PayStep } from './flow/PayStep';
import { ReviewStep } from './flow/ReviewStep';
import { captureBooking } from '@/components/renters/bookingCapture';

export function BookingFlow({ operator, vehicle, initialDates }: { operator: Operator; vehicle: Vehicle; initialDates?: { start: string; end: string } }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<BookingCart>(() => {
    const base = createBookingCart({ operator, vehicle });
    // Protection is mandatory Premium and extras are gone (both steps removed).
    // Pinned here rather than in the removed steps so the cart is correct from
    // the first render in BOTH modes — mock included, which no longer has a
    // ProtectStep to set it. rent-create-booking validates the tier and 400s on
    // anything outside premium/standard/decline, so this must always be set.
    // Dates carried from a grid filter (MP-10 / T-13) seed the dates step; a
    // window shorter than the car's minimum stay is stretched to it. The
    // seed then passes the SAME bookability rule the calendar applies (not
    // past, no blocked day, drop-off day included) or it is dropped — a
    // stale link, or a grid that could not check availability, must never
    // land the renter on a selection the calendar shows crossed out.
    const stretched = initialDates
      ? {
          start: initialDates.start,
          end: daysBetween(initialDates.start, initialDates.end) >= vehicle.minRentalDays ? initialDates.end : addDays(initialDates.start, vehicle.minRentalDays),
        }
      : undefined;
    const seeded = stretched && rangeIsBookable(vehicle, stretched.start, stretched.end, localTodayIso()) ? stretched : base.dates;
    const base5 = recomputeBookingCart({ ...base, dates: seeded, protection: 'premium', extras: [] });
    if (getDataMode() !== 'supabase') return base5;
    // Live mode additionally starts the driver form empty — the base cart
    // carries a demo identity that is only correct for mock and /preview.
    return recomputeBookingCart({ ...base5, driver: { name: '', dob: '', phone: '', email: '' } });
  });
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | undefined>();
  const next = () => setStep((value) => Math.min(value + 1, 4));
  const back = step > 1 ? () => setStep((value) => value - 1) : undefined;

  // Funnel: one event per step reached after the first (the book page's own
  // mount already records book_start). Renter details never ride along.
  useEffect(() => {
    if (step > 1) track('book_step', { step, team: operator.slug, vehicle: vehicle.slug });
  }, [step, operator.slug, vehicle.slug]);

  // Server-authoritative pricing for the commit steps (review + reserve).
  // The state carries the key it was fetched for, and readers only trust it
  // when that key still matches the cart: showing a stale total for a changed
  // selection is the worst failure here, because it looks correct.
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' });
  const currentKey = quoteKey(cart);
  const quote = quoteState.status === 'ready' && quoteState.key === currentKey ? quoteState.quote : null;

  const refreshQuote = useCallback(async () => {
    if (!quotingEnabled()) return;
    const key = quoteKey(cart);
    setQuoteState({ status: 'loading', key });
    try {
      const fresh = await loadQuote(cart);
      setQuoteState({ status: 'ready', key, quote: fresh });
    } catch (error) {
      setQuoteState({
        status: 'error',
        key,
        message: error instanceof QuoteUnavailableError
          ? error.message
          : "We couldn't confirm final pricing. Please try again.",
      });
    }
  }, [cart]);

  // Quote once the renter reaches the commit steps, and re-quote whenever the
  // priced selection changes underneath them (e.g. they step back and edit).
  // Review is step 3 now that Extras and Protect are gone — this threshold
  // moved with them. If it drifts high the renter reaches Review before a
  // quote is requested and sees the blocked state for no reason; if it drifts
  // low we quote on every date tap and burn the anonymous rate limit.
  useEffect(() => {
    if (!quotingEnabled() || step < 3) return;
    if (quoteState.status !== 'idle' && quoteState.key === currentKey) return;
    void refreshQuote();
  }, [step, currentKey, quoteState, refreshQuote]);

  // In live mode the renter must never commit against unconfirmed numbers.
  const quoteBlocking = quotingEnabled() && !quote;

  const reserve = async () => {
    if (reserving) return;
    setReserving(true);
    setReserveError(undefined);
    // No driver email is stashed for the confirmation page: identity
    // verification is authorized by the booking's confirmation_token, which
    // travels on the ?t= link below.
    try {
      // Mock mode: fixed demo ref. Supabase mode: rent-create-booking with a
      // server-side re-quote and transactional double-booking guard.
      const result = await createRenterBooking(cart);
      const query = result.confirmationToken ? `?t=${encodeURIComponent(result.confirmationToken)}` : '';
      // The ref only — the confirmation token is the renter's credential.
      track('booking_created', { booking: result.bookingRef, team: operator.slug, vehicle: vehicle.slug, protection: cart.protection });
      // MP-14: the renter store learns the address + consent now; keepalive, never awaited.
      captureBooking(cart, result.bookingRef);
      router.push(`/booking/${result.bookingRef}${query}`);
    } catch (error) {
      setReserveError(error instanceof Error ? error.message : 'Something went wrong — please try again.');
      setReserving(false);
    }
  };

  // Desktop summary rail (M7d): what the renter is booking, beside the panel.
  // Facts only — dates and money are owned by the steps and the server quote,
  // and a second copy of a total is a second place for it to be wrong.
  const rail = (
    <div className="overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#0D0F14]">
      <div className="relative aspect-[4/3] bg-[#161922]">
        {vehicle.heroImage && <Image src={vehicle.heroImage} alt={vehicle.name} fill sizes="320px" className="object-cover" />}
      </div>
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#C8A664]">{operator.name}</div>
        <h2 className="mt-2 text-[20px] leading-[1.15] text-[#F0F2F5]" style={{ fontFamily: 'var(--font-drive-newsreader), Georgia, serif', fontWeight: 500, letterSpacing: '-0.014em' }}>{vehicle.name}</h2>
        <p className="mt-1 text-[12px] text-[#9BA1B0]">{operator.city}, {operator.state}</p>
        <dl className="mt-4 space-y-2 border-t border-[#2A2E3A] pt-4 text-[13px]">
          <div className="flex justify-between gap-4"><dt className="text-[#9BA1B0]">Daily rate</dt><dd className="text-[#F0F2F5]"><Money cents={vehicle.dailyRateCents} /></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#9BA1B0]">Minimum</dt><dd className="text-[#F0F2F5]">{vehicle.minRentalDays} {vehicle.minRentalDays === 1 ? 'day' : 'days'}</dd></div>
        </dl>
        <p className="mt-4 text-[11px] leading-5 text-[#848A9A]">Your dates and total are confirmed in the steps. {operator.name} reviews every request before payment.</p>
      </div>
    </div>
  );

  return (
    <BookingChrome step={step + 1} onBack={back} closeHref={`/${cart.operator.slug}`} rail={rail}>
      {step === 1 && <DatesStep cart={cart} setCart={setCart} next={next} />}
      {step === 2 && <DriverStep cart={cart} setCart={setCart} next={next} />}
      {step === 3 && (
        <ReviewStep
          cart={cart}
          goTo={setStep}
          next={next}
          quote={quote}
          quotePending={quoteState.status === 'loading'}
          quoteError={quoteState.status === 'error' && quoteState.key === currentKey ? quoteState.message : undefined}
          onRetryQuote={refreshQuote}
          blocked={quoteBlocking}
          // T-12: premium stays the default; the renter may decline. quoteKey
          // includes the tier, so this recompute invalidates the current quote
          // and the blocked state holds the renter until fresh numbers arrive —
          // no path to committing against the old tier's total.
          onProtectionChange={(tier) => setCart(recomputeBookingCart({ ...cart, protection: tier }))}
          onMarketingConsentChange={(checked) => setCart({ ...cart, driver: { ...cart.driver, marketingConsent: checked } })}
        />
      )}
      {step === 4 && (
        <PayStep
          cart={cart}
          onPay={reserve}
          paying={reserving}
          payError={reserveError}
          quote={quote}
          quotePending={quoteState.status === 'loading'}
          quoteError={quoteState.status === 'error' && quoteState.key === currentKey ? quoteState.message : undefined}
          onRetryQuote={refreshQuote}
          blocked={quoteBlocking}
        />
      )}
    </BookingChrome>
  );
}
