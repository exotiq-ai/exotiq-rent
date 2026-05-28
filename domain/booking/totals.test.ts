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

  it('derives operator, Exotiq platform/protection, and grand totals in cents', () => {
    const totals = calculateBookingTotals({
      dailyRateCents: 119900,
      startDate: '2026-06-14',
      endDate: '2026-06-17',
      extras,
      protection: 'premium',
      operatorTaxRate: 0.078,
      platformFeeRate: 0.1,
      depositHoldCents: 250000,
    });

    expect(totals.days).toBe(3);
    expect(totals.rentalSubtotalCents).toBe(359700);
    expect(totals.extrasSubtotalCents).toBe(44700);
    expect(totals.operatorTaxesCents).toBe(31543);
    expect(totals.operatorTotalCents).toBe(435943);
    expect(totals.platformFeeBaseCents).toBe(435943);
    expect(totals.platformFeeCents).toBe(43594);
    expect(totals.protectionDailyRateCents).toBe(8900);
    expect(totals.protectionTotalCents).toBe(26700);
    expect(totals.exotiqTotalCents).toBe(70294);
    expect(totals.grandTotalCents).toBe(506237);
    expect(totals.depositHoldCents).toBe(250000);
  });

  it('formats cents as luxury checkout currency', () => {
    expect(formatMoney(506237)).toBe('$5,062');
    expect(formatMoney(506237, { showCents: true })).toBe('$5,062.37');
  });
});
