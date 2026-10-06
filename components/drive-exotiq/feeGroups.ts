import { formatMoney } from '@/domain/booking/totals';

/**
 * The two-party money story as display data (MP-26): what the operator charges,
 * and what Drive Exotiq charges separately. A display fold only. Every number
 * here is an input the surface already holds (the server quote, the booking
 * snapshot, the mock cart); nothing is computed from a rate, and the four
 * Exotiq components stay four numbers in `components`.
 *
 * Subtotals are the CHARGED totals, never a re-sum of the lines: if an input
 * ever fails to reconcile, the renter still sees what will be charged and the
 * gap is reported in `residualCents` instead of being papered over.
 */
export type FoldInput = {
  operatorName: string;
  /** Charged operator leg, operator tax INSIDE. */
  operatorTotalCents: number;
  operatorTaxCents: number;
  /** Server label; default 'Tax'. */
  operatorTaxLabel?: string;
  /** Percent (7.5); the detail "7.5%" shows only when present. */
  operatorTaxRate?: number;
  /** Review and mock only. */
  days?: number;
  dailyRateCents?: number;
  platformFeeCents: number;
  /** Review and mock only. */
  platformFeePercent?: number;
  /** 0 when declined. */
  protectionTotalCents: number;
  /** 0 when none. */
  stateFeeCents: number;
  /** Quote only; default 'State rental fee'. */
  stateFeeLabel?: string;
  /** 0 when none. */
  processingFeeCents: number;
  /** Charged Exotiq leg. */
  exotiqTotalCents: number;
};

export type FeeLine = { key: 'rental' | 'operator-tax' | 'protect' | 'trip-fees' | 'processing'; label: string; detail?: string; cents: number };
export type FeeComponent = { key: 'platform-fee' | 'state-fee'; label: string; detail?: string; cents: number };
export type FeeGroups = {
  operator: { name: string; lines: FeeLine[]; subtotalCents: number; residualCents: number };
  exotiq: { lines: FeeLine[]; tripFees: { cents: number; components: FeeComponent[] }; subtotalCents: number; residualCents: number };
  /** operatorTotalCents + exotiqTotalCents. */
  grandTotalCents: number;
  /** The four Exotiq components, untouched. */
  components: { platformFeeCents: number; protectionTotalCents: number; stateFeeCents: number; processingFeeCents: number };
};

const dayCount = (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`;
const sum = (lines: { cents: number }[]) => lines.reduce((total, line) => total + line.cents, 0);

export function foldFees(input: FoldInput): FeeGroups {
  const { days } = input;

  // Tax rides inside the operator's charge (T-11): the rental line is the charge
  // minus its tax, so the two lines add up to what the statement shows.
  const operatorLines: FeeLine[] = [
    {
      key: 'rental',
      label: 'Rental',
      detail: days != null && input.dailyRateCents != null ? `${days} × ${formatMoney(input.dailyRateCents)}` : undefined,
      cents: input.operatorTotalCents - input.operatorTaxCents,
    },
  ];
  if (input.operatorTaxCents > 0) {
    operatorLines.push({
      key: 'operator-tax',
      label: input.operatorTaxLabel ?? 'Tax',
      detail: input.operatorTaxRate != null ? `${input.operatorTaxRate}%` : undefined,
      cents: input.operatorTaxCents,
    });
  }

  // Trip fees fold the platform fee and the state rental fee, nothing else:
  // Protect is a declinable choice (T-12) and keeps its own line, and card
  // processing is its own subline.
  const components: FeeComponent[] = [
    {
      key: 'platform-fee',
      label: 'Platform fee',
      detail: input.platformFeePercent != null ? `${input.platformFeePercent}% of the rental` : undefined,
      cents: input.platformFeeCents,
    },
  ];
  if (input.stateFeeCents > 0) {
    components.push({
      key: 'state-fee',
      label: input.stateFeeLabel ?? 'State rental fee',
      detail: days != null ? dayCount(days) : undefined,
      cents: input.stateFeeCents,
    });
  }
  const tripFeesCents = sum(components);

  const exotiqLines: FeeLine[] = [];
  if (input.protectionTotalCents > 0) {
    exotiqLines.push({ key: 'protect', label: 'Exotiq Protect', detail: days != null ? `Premium · ${dayCount(days)}` : 'Premium', cents: input.protectionTotalCents });
  }
  exotiqLines.push({ key: 'trip-fees', label: 'Trip fees', cents: tripFeesCents });
  if (input.processingFeeCents > 0) exotiqLines.push({ key: 'processing', label: 'Card processing', cents: input.processingFeeCents });

  return {
    operator: {
      name: input.operatorName,
      lines: operatorLines,
      subtotalCents: input.operatorTotalCents,
      residualCents: input.operatorTotalCents - sum(operatorLines),
    },
    exotiq: {
      lines: exotiqLines,
      tripFees: { cents: tripFeesCents, components },
      subtotalCents: input.exotiqTotalCents,
      residualCents: input.exotiqTotalCents - sum(exotiqLines),
    },
    grandTotalCents: input.operatorTotalCents + input.exotiqTotalCents,
    components: {
      platformFeeCents: input.platformFeeCents,
      protectionTotalCents: input.protectionTotalCents,
      stateFeeCents: input.stateFeeCents,
      processingFeeCents: input.processingFeeCents,
    },
  };
}
