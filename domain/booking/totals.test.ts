import { describe, expect, it } from 'vitest';
import { calculateBookingTotals, countRentalDays, formatMoney } from './totals';
import type { ExtraSelection } from './types';

const extras: ExtraSelection[] = [
  { id: 'delivery', name: 'Concierge delivery', priceCents: 15000, unit: 'flat' },
  { id: 'driver', name: 'Additional driver', priceCents: 9900, unit: 'day' },
];

describe('booking totals', () => {
  it('counts Jun 14 to Jun 17 as a three-day rental', () => {
    expect(countRentalDays('2026-06-14', '2026-06-17')).toBe(3);
  });

  it('derives operator, protection, and grand totals in cents', () => {
    const totals = calculateBookingTotals({
      dailyRateCents: 119900,
      startDate: '2026-06-14',
      endDate: '2026-06-17',
      extras,
      protection: 'premium',
      operatorTaxRate: 0.078,
    });

    expect(totals.days).toBe(3);
    expect(totals.rentalSubtotalCents).toBe(359700);
    expect(totals.extrasSubtotalCents).toBe(44700);
    expect(totals.operatorTaxesCents).toBe(31543);
    expect(totals.operatorTotalCents).toBe(435943);
    expect(totals.protectionDailyRateCents).toBe(8900);
    expect(totals.protectionTotalCents).toBe(26700);
    expect(totals.grandTotalCents).toBe(462643);
  });

  it('formats cents as luxury checkout currency', () => {
    expect(formatMoney(462643)).toBe('$4,626');
    expect(formatMoney(462643, { showCents: true })).toBe('$4,626.43');
  });
});
