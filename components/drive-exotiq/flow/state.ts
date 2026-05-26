import type { BookingCart } from '@/domain/booking/types';
import { calculateBookingTotals } from '@/domain/booking/totals';

const taxRate = 0.078;

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
    }),
  };
}
