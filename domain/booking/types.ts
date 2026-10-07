export type ProtectionTier = 'premium' | 'standard' | 'decline';
export type ExtraUnit = 'flat' | 'day';

export type OperatorPolicies = {
  minimumDriverAge: number;
  freeCancellationHours: number;
  milesIncludedPerDay: number | 'unlimited';
  fuelPolicy: string;
  deliveryAvailable: boolean;
  deliveryNote?: string;
};

export type Operator = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  /** Renter-facing contact number. Live mode fills this from the team's
   * CC support_phone; empty string hides every Call affordance. */
  phone: string;
  supportEmail?: string;
  pickupAddress?: string;
  /** Operator free text — ALWAYS rendered as plain text, never as HTML/links. */
  pickupInstructions?: string;
  logoUrl?: string;
  timezone?: string;
  stripeAccountId?: string;
  platformFeePercent?: number;
  about?: string;
  policies?: OperatorPolicies;
};

export type PickupLocation = {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
};

/** Inclusive local-date range (YYYY-MM-DD) during which a vehicle cannot be booked. */
export type UnavailableDateRange = {
  start: string;
  end: string;
};

/** KNOWN means the checked ranges are known, never that selected dates are free
 * or held. UI metadata is not server authorization; the database remains final.
 */
export type AvailabilityAuthority =
  | { status: 'KNOWN'; checkedAt: string; windowStart: string; windowEnd: string }
  | { status: 'UNKNOWN'; reason: 'not_checked' | 'upstream_unavailable' | 'invalid_response' | 'outside_checked_window' | 'stale'; retryAfterSeconds: number };
export type AvailabilityWindow = { start: string; end: string };
export const AVAILABILITY_MAX_AGE_MS = 300000;

export function validAvailabilityDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

/** Reassess cached evidence at every proceed/write check. Five-minute freshness
 * matches the existing catalog cycle; window misses require a new context read.
 */
export function currentAvailabilityAuthority(authority?: AvailabilityAuthority, now = Date.now()): AvailabilityAuthority {
  if (!authority || authority.status !== 'KNOWN') return authority?.status === 'UNKNOWN' ? authority : { status: 'UNKNOWN', reason: 'not_checked', retryAfterSeconds: 30 };
  const checked = Date.parse(authority.checkedAt);
  if (!Number.isFinite(now) || typeof authority.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(authority.checkedAt) || !Number.isFinite(checked) ||
      new Date(checked).toISOString().slice(0, 19) !== authority.checkedAt.slice(0, 19) || checked > now ||
      !validAvailabilityDate(authority.windowStart) || !validAvailabilityDate(authority.windowEnd) || authority.windowEnd < authority.windowStart) {
    return { status: 'UNKNOWN', reason: 'invalid_response', retryAfterSeconds: 30 };
  }
  if (now - checked > AVAILABILITY_MAX_AGE_MS) return { status: 'UNKNOWN', reason: 'stale', retryAfterSeconds: 1 };
  return authority;
}

export function hasKnownAvailability(vehicle: Pick<Vehicle, 'availabilityAuthority' | 'unavailableRanges'>, start: string, end: string, now = Date.now()): boolean {
  const authority = currentAvailabilityAuthority(vehicle.availabilityAuthority, now);
  return authority.status === 'KNOWN' && validAvailabilityDate(start) && validAvailabilityDate(end) && end > start &&
    start >= authority.windowStart && end <= authority.windowEnd && Array.isArray(vehicle.unavailableRanges) &&
    vehicle.unavailableRanges.every((range) => range && validAvailabilityDate(range.start) && validAvailabilityDate(range.end) && range.end >= range.start);
}

export type Vehicle = {
  id: string;
  slug: string;
  operatorId: string;
  name: string;
  shortName: string;
  year: number;
  make: string;
  model: string;
  dailyRateCents: number;
  minRentalDays: number;
  securityDepositCents: number;
  photos: string[];
  heroImage: string;
  /** Marketing specs exist only in mock/curated data; the public read RPCs do not expose them. */
  specs?: {
    zeroToSixty: string;
    power: string;
    engine: string;
    transmission: string;
  };
  footnote: string;
  pickupLocation: PickupLocation;
  /** Body/type classification slug from the fixed vocabulary (MP-9); unset until the tenant classifies the car. */
  bodyType?: string;
  /** Visible gallery photos, when the read exposes it (marketplace fleet RPC today; team fleet RPC pending). */
  photoCount?: number;
  /** Busy ranges the renter cannot select. Mirrors the future get_vehicle_availability RPC shape. */
  unavailableRanges?: UnavailableDateRange[];
  /** Additive compatibility: absent is UNKNOWN, never inferred from an empty list. */
  availabilityAuthority?: AvailabilityAuthority;
  /** Not marketplace-visible: excluded from storefronts and unresolvable by slug (mirrors server-side visibility). */
  hidden?: boolean;
};

export type ExtraSelection = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  unit: ExtraUnit;
  defaultSelected?: boolean;
};

export type Driver = {
  name: string;
  dob: string;
  phone: string;
  email?: string;
  /** MP-14: ticked at the Review step; posted with the booking to the renter store. Never sent to the operator. */
  marketingConsent?: boolean;
};

export type BookingTotals = {
  days: number;
  rentalSubtotalCents: number;
  extrasSubtotalCents: number;
  operatorTaxesCents: number;
  operatorTotalCents: number;
  platformFeeRate: number;
  platformFeeBaseCents: number;
  platformFeeCents: number;
  protectionDailyRateCents: number;
  protectionTotalCents: number;
  exotiqTotalCents: number;
  grandTotalCents: number;
  depositHoldCents: number;
};

export type BookingCart = {
  operator: Operator;
  vehicle: Vehicle;
  dates: { start: string; end: string };
  pickupTime: string;
  driver: Driver;
  extras: ExtraSelection[];
  protection: ProtectionTier;
  totals: BookingTotals;
  paymentMethod?: 'apple_pay' | 'card';
  bookingId?: string;
};
