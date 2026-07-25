'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingChrome } from './BookingChrome';
import { DRIVER_EMAIL_STORAGE_KEY } from './IdentityVerificationCard';
import { createBookingCart, createRenterBooking } from '@/domain/booking/service';
import { getDataMode } from '@/domain/booking/config';
import { loadQuote, quoteKey, quotingEnabled, QuoteUnavailableError, type QuoteState } from '@/domain/booking/quote';
import { recomputeBookingCart } from './flow/state';
import type { BookingCart, Operator, Vehicle } from '@/domain/booking/types';
import { DatesStep } from './flow/DatesStep';
import { DriverStep } from './flow/DriverStep';
import { ExtrasStep } from './flow/ExtrasStep';
import { PayStep } from './flow/PayStep';
import { ProtectStep } from './flow/ProtectStep';
import { ReviewStep } from './flow/ReviewStep';

export function BookingFlow({ operator, vehicle }: { operator: Operator; vehicle: Vehicle }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<BookingCart>(() => {
    const base = createBookingCart({ operator, vehicle });
    // The base cart carries demo fixtures (a fake driver identity, a
    // default-selected concierge extra) that are correct only for the mock
    // demo and /preview. In live (supabase) mode a real renter must start
    // with an empty driver form and no extras — extras are not part of the
    // booking-create contract and would otherwise be billed in the UI but
    // never sent to the operator.
    if (getDataMode() !== 'supabase') return base;
    return recomputeBookingCart({
      ...base,
      driver: { name: '', dob: '', phone: '', email: '' },
      extras: [],
    });
  });
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | undefined>();
  const next = () => setStep((value) => Math.min(value + 1, 6));
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
  useEffect(() => {
    if (!quotingEnabled() || step < 5) return;
    if (quoteState.status !== 'idle' && quoteState.key === currentKey) return;
    void refreshQuote();
  }, [step, currentKey, quoteState, refreshQuote]);

  // In live mode the renter must never commit against unconfirmed numbers.
  const quoteBlocking = quotingEnabled() && !quote;

  const reserve = async () => {
    if (reserving) return;
    setReserving(true);
    setReserveError(undefined);
    // Hand the driver email to the confirmation page (session-local only) so
    // post-payment identity verification can start without re-asking (V1 ruling).
    try {
      if (cart.driver.email) sessionStorage.setItem(DRIVER_EMAIL_STORAGE_KEY, cart.driver.email);
    } catch {
      // Storage unavailable (private mode) — the identity card asks instead.
    }
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
    <BookingChrome step={step + 1} onBack={back}>
      {step === 1 && <DatesStep cart={cart} setCart={setCart} next={next} />}
      {step === 2 && <DriverStep cart={cart} setCart={setCart} next={next} />}
      {step === 3 && <ExtrasStep cart={cart} setCart={setCart} next={next} />}
      {step === 4 && <ProtectStep cart={cart} setCart={setCart} next={next} />}
      {step === 5 && (
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
      {step === 6 && (
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
