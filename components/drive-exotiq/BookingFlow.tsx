'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingChrome } from './BookingChrome';
import { DRIVER_EMAIL_STORAGE_KEY } from './IdentityVerificationCard';
import { createBookingCart } from '@/domain/booking/service';
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
  const [cart, setCart] = useState<BookingCart>(() => createBookingCart({ operator, vehicle }));
  const bookingRef = 'BK-01001';
  const next = () => setStep((value) => Math.min(value + 1, 6));
  const back = step > 1 ? () => setStep((value) => value - 1) : undefined;
  const confirmationHref = useMemo(() => `/booking/${bookingRef}`, [bookingRef]);

  return (
    <BookingChrome step={step + 1} onBack={back}>
      {step === 1 && <DatesStep cart={cart} setCart={setCart} next={next} />}
      {step === 2 && <DriverStep cart={cart} setCart={setCart} next={next} />}
      {step === 3 && <ExtrasStep cart={cart} setCart={setCart} next={next} />}
      {step === 4 && <ProtectStep cart={cart} setCart={setCart} next={next} />}
      {step === 5 && <ReviewStep cart={cart} goTo={setStep} next={next} />}
      {step === 6 && (
        <PayStep
          cart={cart}
          onPay={() => {
            // Hand the driver email to the confirmation page (session-local
            // only) so post-payment identity verification can start without
            // re-asking — ID plan V1 ruling.
            try {
              if (cart.driver.email) sessionStorage.setItem(DRIVER_EMAIL_STORAGE_KEY, cart.driver.email);
            } catch {
              // Storage unavailable (private mode) — the card will ask for the email instead.
            }
            router.push(confirmationHref);
          }}
        />
      )}
    </BookingChrome>
  );
}
