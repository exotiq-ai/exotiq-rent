import type { BookingTotals, ExtraSelection, ProtectionTier } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PROTECTION_DAILY_RATES: Record<ProtectionTier, number> = {
  premium: 8900,
  standard: 5900,
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
}): BookingTotals {
  const days = countRentalDays(input.startDate, input.endDate);
  const rentalSubtotalCents = input.dailyRateCents * days;
  const extrasSubtotalCents = calculateExtrasSubtotal(input.extras, days);
  const taxableOperatorSubtotal = rentalSubtotalCents + extrasSubtotalCents;
  const operatorTaxesCents = Math.round(taxableOperatorSubtotal * input.operatorTaxRate);
  const operatorTotalCents = taxableOperatorSubtotal + operatorTaxesCents;
  const platformFeeRate = input.platformFeeRate ?? 0.1;
  // Product rule: Exotiq.Rent charges a 10% platform fee on the booking
  // amount due for the rental, excluding any deposit/security authorization.
  // The current scaffold has no deposit line, so the operator total is the
  // platform-fee base. Protection is an Exotiq pass-through line and is not
  // used as a fee-on-fee base.
  const platformFeeBaseCents = operatorTotalCents;
  const platformFeeCents = Math.round(platformFeeBaseCents * platformFeeRate);
  const protectionDailyRateCents = PROTECTION_DAILY_RATES[input.protection];
  const protectionTotalCents = protectionDailyRateCents * days;
  const exotiqTotalCents = platformFeeCents + protectionTotalCents;
  const grandTotalCents = operatorTotalCents + exotiqTotalCents;

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
