import type { BookingCart } from '@/domain/booking/types';
import { calculateBookingTotals } from '@/domain/booking/totals';

// The backend quote charges no separate operator tax (public_vehicle_quote =
// rental + fee + protection only), so any client-side tax produces a shown
// total that never matches what is actually charged. Keep it at zero.
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
