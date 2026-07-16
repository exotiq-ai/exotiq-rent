import type { BookingTotals, ExtraSelection, ProtectionTier } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// D5 (docs/rent/DECISIONS.md, 2026-07-15): Standard $89/day, Premium $289/day.
const PROTECTION_DAILY_RATES: Record<ProtectionTier, number> = {
  premium: 28900,
  standard: 8900,
  decline: 0,
};

export function countRentalDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 0;
  return Math.max(0, Math.round((end.valueOf() - start.valueOf()) / MS_PER_DAY));
}

export function calculateExtrasSubtotal(extras: ExtraSelection[], days: number): number {
  return extras.reduce((sum, extra) => {
    const multiplier = extra.unit === 'day' ? days : 1;
    return sum + extra.priceCents * multiplier;
  }, 0);
}

export function calculateBookingTotals(input: {
  dailyRateCents: number;
  startDate: string;
  endDate: string;
  extras: ExtraSelection[];
  protection: ProtectionTier;
  operatorTaxRate: number;
  platformFeeRate?: number;
  depositHoldCents?: number;
}): BookingTotals {
  const days = countRentalDays(input.startDate, input.endDate);
  const rentalSubtotalCents = input.dailyRateCents * days;
  const extrasSubtotalCents = calculateExtrasSubtotal(input.extras, days);
  const taxableOperatorSubtotal = rentalSubtotalCents + extrasSubtotalCents;
  const operatorTaxesCents = Math.round(taxableOperatorSubtotal * input.operatorTaxRate);
  const operatorTotalCents = taxableOperatorSubtotal + operatorTaxesCents;
  const platformFeeRate = input.platformFeeRate ?? 0.1;
  // D1 + D9 (docs/rent/DECISIONS.md, 2026-07-15): the renter-facing booking
  // fee is 10% of the rental subtotal only (daily rate × days). Extras,
  // operator taxes, deposits, and protection are all excluded from the base.
  // Matches the Command Center's compute_rental_base / public_vehicle_quote.
  const platformFeeBaseCents = rentalSubtotalCents;
  const platformFeeCents = Math.round(platformFeeBaseCents * platformFeeRate);
  const protectionDailyRateCents = PROTECTION_DAILY_RATES[input.protection];
  const protectionTotalCents = protectionDailyRateCents * days;
  const exotiqTotalCents = platformFeeCents + protectionTotalCents;
  const grandTotalCents = operatorTotalCents + exotiqTotalCents;
  const depositHoldCents = input.depositHoldCents ?? 0;

  return {
    days,
    rentalSubtotalCents,
    extrasSubtotalCents,
    operatorTaxesCents,
    operatorTotalCents,
    platformFeeRate,
    platformFeeBaseCents,
    platformFeeCents,
    protectionDailyRateCents,
    protectionTotalCents,
    exotiqTotalCents,
    grandTotalCents,
    depositHoldCents,
  };
}

export function formatMoney(cents: number, options: { showCents?: boolean } = {}): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options.showCents ? 2 : 0,
    maximumFractionDigits: options.showCents ? 2 : 0,
  }).format(dollars);
}

export function getProtectionDailyRateCents(tier: ProtectionTier): number {
  return PROTECTION_DAILY_RATES[tier];
}
