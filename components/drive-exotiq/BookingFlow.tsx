'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingChrome } from './BookingChrome';
import { createBookingCart, createRenterBooking } from '@/domain/booking/service';
import { getDataMode } from '@/domain/booking/config';
import { loadQuote, quoteKey, quotingEnabled, QuoteUnavailableError, type QuoteState } from '@/domain/booking/quote';
import { recomputeBookingCart } from './flow/state';
import type { BookingCart, Operator, Vehicle } from '@/domain/booking/types';
import { DatesStep } from './flow/DatesStep';
import { DriverStep } from './flow/DriverStep';
import { PayStep } from './flow/PayStep';
import { ReviewStep } from './flow/ReviewStep';

export function BookingFlow({ operator, vehicle }: { operator: Operator; vehicle: Vehicle }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<BookingCart>(() => {
    const base = createBookingCart({ operator, vehicle });
    // Protection is mandatory Premium and extras are gone (both steps removed).
    // Pinned here rather than in the removed steps so the cart is correct from
    // the first render in BOTH modes — mock included, which no longer has a
    // ProtectStep to set it. rent-create-booking validates the tier and 400s on
    // anything outside premium/standard/decline, so this must always be set.
    const base5 = recomputeBookingCart({ ...base, protection: 'premium', extras: [] });
    if (getDataMode() !== 'supabase') return base5;
    // Live mode additionally starts the driver form empty — the base cart
    // carries a demo identity that is only correct for mock and /preview.
    return recomputeBookingCart({ ...base5, driver: { name: '', dob: '', phone: '', email: '' } });
  });
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | undefined>();
  const next = () => setStep((value) => Math.min(value + 1, 4));
  const back = step > 1 ? () => setStep((value) => value - 1) : undefined;

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
      router.push(`/booking/${result.bookingRef}${query}`);
    } catch (error) {
      setReserveError(error instanceof Error ? error.message : 'Something went wrong — please try again.');
      setReserving(false);
    }
  };

  return (
    <BookingChrome step={step + 1} onBack={back} closeHref={`/${cart.operator.slug}`}>
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
