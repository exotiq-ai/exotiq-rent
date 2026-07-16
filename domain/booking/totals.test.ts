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
    // D1/D9: fee base is the rental subtotal only — extras and taxes excluded.
    expect(totals.platformFeeBaseCents).toBe(359700);
    expect(totals.platformFeeCents).toBe(35970);
    expect(totals.protectionDailyRateCents).toBe(28900);
    expect(totals.protectionTotalCents).toBe(86700);
    expect(totals.exotiqTotalCents).toBe(122670);
    expect(totals.grandTotalCents).toBe(558613);
    expect(totals.depositHoldCents).toBe(250000);
  });

  it('matches the D1/D9/D5 sample quote to the cent (3 days × $1,999, premium)', () => {
    const totals = calculateBookingTotals({
      dailyRateCents: 199900,
      startDate: '2026-06-14',
      endDate: '2026-06-17',
      extras: [],
      protection: 'premium',
      operatorTaxRate: 0,
      platformFeeRate: 0.1,
    });

    expect(totals.rentalSubtotalCents).toBe(599700); // $5,997.00 rental
    expect(totals.platformFeeCents).toBe(59970); // $599.70 booking fee
    expect(totals.protectionTotalCents).toBe(86700); // $867.00 premium protection
    expect(totals.grandTotalCents).toBe(746370); // $7,463.70
  });

  it('keeps the booking fee unchanged when extras are added (D9)', () => {
    const base = { dailyRateCents: 119900, startDate: '2026-06-14', endDate: '2026-06-17', protection: 'decline' as const, operatorTaxRate: 0.078, platformFeeRate: 0.1 };
    const withoutExtras = calculateBookingTotals({ ...base, extras: [] });
    const withExtras = calculateBookingTotals({ ...base, extras });

    expect(withExtras.extrasSubtotalCents).toBeGreaterThan(0);
    expect(withExtras.platformFeeCents).toBe(withoutExtras.platformFeeCents);
  });

  it('formats cents as luxury checkout currency', () => {
    expect(formatMoney(506237)).toBe('$5,062');
    expect(formatMoney(506237, { showCents: true })).toBe('$5,062.37');
  });
});
