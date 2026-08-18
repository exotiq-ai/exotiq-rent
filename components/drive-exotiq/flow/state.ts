import type { BookingCart } from '@/domain/booking/types';
import { calculateBookingTotals } from '@/domain/booking/totals';

// Operator tax is SERVER-computed (public_vehicle_quote returns
// operator_tax_* since 2026-08-17, per-tenant from Command Center settings).
// The client engine never invents a rate: a client-side guess produces a
// shown total that may not match the charge. Zero here means "no tax in
// mock mode"; live totals always come from the quote.
const taxRate = 0;

export function recomputeBookingCart(cart: BookingCart): BookingCart {
  return {
    ...cart,
    totals: calculateBookingTotals({
      dailyRateCents: cart.vehicle.dailyRateCents,
      startDate: cart.dates.start,
      endDate: cart.dates.end,
      extras: cart.extras,
      protection: cart.protection,
      operatorTaxRate: taxRate,
      platformFeeRate: (cart.operator.platformFeePercent ?? 10) / 100,
      depositHoldCents: cart.vehicle.securityDepositCents,
    }),
  };
}
