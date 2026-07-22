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
    phone: '',
    logoUrl: row.logo_url ?? undefined,
    timezone: row.timezone ?? undefined,
    about: row.public_description ?? undefined,
  };
}

function footnoteFor(minRentalDays: number, mileageLimit: number | null | undefined): string {
  const minimum = minRentalDays > 1 ? `${minRentalDays}-day minimum` : 'No minimum';
  const mileage = mileageLimit ? `${mileageLimit} miles/day included` : 'Mileage per operator policy';
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
    footnote: footnoteFor(base.minRentalDays, row.default_mileage_limit),
    pickupLocation: {
      name: `${team.name} pickup`,
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
  // The 2026-07-22 backend fee update rolled the security deposit into
  // operator_total_cents and grand_total_cents. Renter-facing semantics keep
  // the deposit as a separate authorization hold (matching mock totals), so
  // strip it back out of the charge lines here.
  const depositCents = Number(row.deposit_cents ?? 0);
  const operatorChargeCents = Number(row.operator_total_cents) - depositCents;
  return {
    currency: 'usd',
    rentalDays: row.rental_days,
    dailyRateCents: Number(row.daily_rate_cents),
    rentalSubtotalCents: Number(row.rental_subtotal_cents),
    extrasSubtotalCents: 0, // extras are outside the fee base (D9) and not in the M3 quote
    operatorTaxesCents: operatorChargeCents - Number(row.rental_subtotal_cents),
    operatorTotalCents: operatorChargeCents,
    platformFeeRate: Number(row.platform_fee_percent) / 100,
    platformFeeCents: Number(row.platform_fee_cents),
    protectionDailyRateCents: Number(row.protection_daily_cents),
    protectionTotalCents: Number(row.protection_total_cents),
    exotiqTotalCents: Number(row.exotiq_total_cents),
    grandTotalCents: Number(row.grand_total_cents) - depositCents,
    depositHoldCents: depositCents,
    cancellationPolicy: {
      freeCancellationHours: 72,
      platformFeeRefundableInWindow: true,
      protectionRefundableInWindow: true,
    },
  };
}
