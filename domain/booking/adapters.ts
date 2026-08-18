import type {
  RpcBusyRangeRow,
  RpcFleetVehicleRow,
  RpcQuoteRow,
  RpcTeamRow,
  RpcVehicleDetailRow,
  SignedMediaResponse,
} from './rpcClient';
import type { Operator, UnavailableDateRange, Vehicle } from './types';
import type { PublicQuote } from './publicContracts';

/**
 * RPC row -> domain adapters (M4). Money crosses this boundary exactly once:
 * the DB speaks dollars (numeric), the app speaks integer cents.
 * The read RPCs expose no team id, phone, deposit, or engine specs by
 * design — adapters map what exists and leave the rest empty/optional so
 * the UI degrades gracefully.
 */

export function dollarsToCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const dollars = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}

export function adaptTeam(row: RpcTeamRow): Operator {
  return {
    // Public reads expose no internal team id; the slug is the public identity.
    id: `team:${row.slug}`,
    slug: row.slug,
    name: row.name,
    city: row.city ?? '',
    state: row.state ?? '',
    // The team's CC support number IS the renter-facing phone — this single
    // mapping lights up every existing "Call {operator}" affordance (T-15).
    phone: row.support_phone ?? '',
    supportEmail: row.support_email ?? undefined,
    pickupAddress: row.pickup_address ?? undefined,
    pickupInstructions: row.pickup_instructions ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    timezone: row.timezone ?? undefined,
    about: row.public_description ?? undefined,
  };
}

function footnoteFor(minRentalDays: number, mileageLimit: number | null | undefined, overageRate?: number | string | null): string {
  // A 1-day minimum is still a minimum. "No minimum" contradicted the booking
  // preview tile beside it, which read the same field and said "Minimum: 1 day".
  const minimum = `${minRentalDays}-day minimum`;
  // Overage rate shown pre-booking (T-15): the renter must see the terms the
  // booking snapshot will freeze, before agreeing to them.
  const overage = overageRate != null && Number(overageRate) > 0 ? ` · then $${Number(overageRate).toFixed(2)}/mile` : '';
  const mileage = mileageLimit ? `${mileageLimit} miles/day included${overage}` : 'Mileage per operator policy';
  return `${minimum} · ${mileage}`;
}

export function adaptFleetVehicle(row: RpcFleetVehicleRow, team: Operator): Vehicle {
  const minRentalDays = row.min_rental_days ?? 1;
  return {
    id: `veh:${team.slug}:${row.vehicle_slug}`,
    slug: row.vehicle_slug,
    operatorId: team.id,
    name: row.name ?? [row.year, row.make, row.model].filter(Boolean).join(' '),
    shortName: [row.make, row.model].filter(Boolean).join(' ') || (row.name ?? row.vehicle_slug),
    year: row.year ?? 0,
    make: row.make ?? '',
    model: row.model ?? '',
    dailyRateCents: dollarsToCents(row.daily_rate),
    minRentalDays,
    securityDepositCents: 0, // not publicly exposed; quoted server-side at booking (M5)
    photos: row.hero_image_url ? [row.hero_image_url] : [],
    heroImage: row.hero_image_url ?? '',
    footnote: footnoteFor(minRentalDays, null),
    pickupLocation: { name: `${team.name} pickup`, address: '', city: team.city, state: team.state },
  };
}

export function adaptVehicleDetail(row: RpcVehicleDetailRow, team: Operator, media?: SignedMediaResponse): Vehicle {
  const base = adaptFleetVehicle(row, team);
  const signedPhotos = (media?.photos ?? [])
    .slice()
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((photo) => photo.signedUrl)
    .filter(Boolean);
  const photos = signedPhotos.length > 0 ? signedPhotos : base.photos;

  return {
    ...base,
    photos,
    heroImage: photos[0] ?? base.heroImage,
    footnote: footnoteFor(base.minRentalDays, row.default_mileage_limit, row.mileage_overage_rate),
    pickupLocation: {
      // No fabricated name. The public RPCs expose no pickup address or venue
      // name, and `${team.name} pickup` rendered as "Drive Exotiq pickup" under a
      // "Pickup location" heading on a page that already names the operator —
      // the word "pickup" twice and no new information. Empty means the UI shows
      // only what we actually know (city/state).
      name: '',
      address: '',
      city: row.pickup_city ?? team.city,
      state: row.pickup_state ?? team.state,
    },
  };
}

export function adaptBusyRanges(rows: RpcBusyRangeRow[]): UnavailableDateRange[] {
  return rows.map((row) => ({ start: row.busy_start, end: row.busy_end }));
}

export function adaptQuote(row: RpcQuoteRow): PublicQuote {
  // No deposit arithmetic here any more. The 2026-07-22 quote rolled the
  // deposit INTO operator_total_cents/grand_total_cents and this adapter
  // subtracted it back out; as of the 2026-07-26 decision the backend excludes
  // it from both and returns deposit_cents = 0, verified against production
  // before this was removed (Bugatti: operator_total == rental_subtotal ==
  // 1_500_000, grand_total 1_736_700, deposit_cents 0).
  //
  // Deliberately still reads row.deposit_cents rather than hardcoding 0: if the
  // backend ever reintroduces a non-zero value, depositHoldCents carries it and
  // the totals stay untouched, which fails visibly rather than silently
  // mis-stating a total.
  const depositCents = Number(row.deposit_cents ?? 0);
  const operatorChargeCents = Number(row.operator_total_cents);
  return {
    currency: 'usd',
    rentalDays: row.rental_days,
    dailyRateCents: Number(row.daily_rate_cents),
    rentalSubtotalCents: Number(row.rental_subtotal_cents),
    extrasSubtotalCents: 0, // extras are outside the fee base (D9) and not in the M3 quote
    // Prefer the explicit server column (2026-08-17); the subtraction is the
    // fallback for older quote shapes and MUST equal it when both exist —
    // operator_total = rental_subtotal + tax is the server's own invariant.
    operatorTaxesCents: Number(row.operator_tax_cents ?? (operatorChargeCents - Number(row.rental_subtotal_cents))),
    operatorTaxLabel: row.operator_tax_label ?? undefined,
    operatorTaxRate: row.operator_tax_rate != null ? Number(row.operator_tax_rate) : undefined,
    operatorTotalCents: operatorChargeCents,
    platformFeeRate: Number(row.platform_fee_percent) / 100,
    platformFeeCents: Number(row.platform_fee_cents),
    protectionDailyRateCents: Number(row.protection_daily_cents),
    protectionTotalCents: Number(row.protection_total_cents),
    // Optional on the wire so an older quote shape still adapts; a missing
    // column becomes 0 and simply renders no row. They are NOT added into
    // exotiqTotalCents here — the server already includes them, and adding
    // them again would double-count.
    processingFeeCents: Number(row.processing_fee_cents ?? 0),
    stateFeeCents: Number(row.state_fee_cents ?? 0),
    stateFeeLabel: row.state_fee_label ?? undefined,
    exotiqTotalCents: Number(row.exotiq_total_cents),
    grandTotalCents: Number(row.grand_total_cents),
    depositHoldCents: depositCents,
    cancellationPolicy: {
      freeCancellationHours: 72,
      platformFeeRefundableInWindow: true,
      protectionRefundableInWindow: true,
    },
  };
}
