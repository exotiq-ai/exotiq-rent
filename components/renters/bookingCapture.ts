'use client';

import type { BookingCart } from '@/domain/booking/types';
import { renterCaptureUiEnabled } from '@/domain/renters/config';

/**
 * The booking moment (MP-14): the renter has just given a real name and
 * e-mail, so record them with whatever consent they ticked. Fire-and-forget
 * with `keepalive` — the navigation to the confirmation page follows at
 * once and must never wait on, or fail because of, this call.
 */
export function captureBooking(cart: BookingCart, bookingRef: string): void {
  if (!renterCaptureUiEnabled()) return;
  const email = cart.driver.email?.trim();
  if (!email) return;
  try {
    void fetch('/api/renters/capture', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: cart.driver.name,
        phone: cart.driver.phone,
        source: 'booking',
        consent: Boolean(cart.driver.marketingConsent),
        booking_ref: bookingRef,
        team_slug: cart.operator.slug,
        vehicle_slug: cart.vehicle.slug,
        path: window.location.pathname,
      }),
    }).catch(() => undefined);
  } catch {
    // Never surfaces to the renter.
  }
}
