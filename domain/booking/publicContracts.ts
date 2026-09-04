import type { Operator, Vehicle } from './types';

export type PublicVehicleContext = {
  team: Operator;
  vehicle: Vehicle;
};

export type PublicTeamStorefront = {
  team: Operator;
  vehicles: Vehicle[];
};

export type PublicBookingConfirmation = {
  bookingRef: string;
  team: Operator;
  vehicle: Vehicle;
  /** Present when the confirmation was read from a real booking (supabase mode). */
  live?: {
    status: string;
    startAt: string;
    endAt: string;
    totalCents: number;
    /** M6b payment fields — absent until the backend patch is applied, which
     * doubles as the staging gate for the pay CTA. */
    paymentDueAt?: string;
    paidAt?: string;
    protectionTier?: string;
    platformFeeCents?: number;
    protectionTotalCents?: number;
    /** The Exotiq leg is FOUR components, not two. Omitting these under-quoted
     * the renter on the payment screen by the state + processing amounts. */
    stateFeeCents?: number;
    processingFeeCents?: number;
    /** Operator tax snapshot — INSIDE totalCents, displayed as its own line
     * ("charged by the operator"), never added to any total again. */
    operatorTaxCents?: number;
    operatorTaxLabel?: string;
    /** Carryover (2026-08-18): pickup + mileage + policy are booking-time
     * SNAPSHOTS; contact + timezone are team context joined by the RPC. */
    timezone?: string;
    identityVerified?: boolean;
    supportEmail?: string;
    supportPhone?: string;
    pickupAddress?: string;
    pickupInstructions?: string;
    mileageLimitPerDay?: number;
    /** Dollars per mile, as the backend stores it (e.g. 4.99). */
    mileageOverageRate?: number;
    cancellationPolicy?: string;
  };
};

/** D4: a booking ref without its access token reveals existence + status only. */
export type RestrictedBookingLookup = {
  restricted: true;
  bookingRef: string;
  status: string;
};

export type BookingLookupResult = PublicBookingConfirmation | RestrictedBookingLookup | null;

export type CreateBookingResult = {
  bookingRef: string;
  confirmationToken?: string;
  status: string;
  identityVerified?: boolean;
};

export type AvailabilityBusyRange = {
  start: string;
  end: string;
};

/** Mirrors identity_verifications.status in the Command Center schema. */
export type IdentityVerificationStatus =
  | 'created'
  | 'processing'
  | 'verified'
  | 'requires_input'
  | 'canceled'
  | 'redacted'
  | 'manual_review';

export type IdentityVerificationStart = {
  sessionId: string;
  status: IdentityVerificationStatus;
  /** Absent when the renter is already verified (marketplace-wide reuse, V7). */
  clientSecret?: string;
  /** Stripe-hosted verification page — the fallback when no publishable key is configured for the modal. */
  hostedUrl?: string;
  reused?: boolean;
};

export type IdentityVerificationState = {
  status: IdentityVerificationStatus;
  lastErrorReason?: string;
  attemptsRemaining: number;
};

export type PublicQuote = {
  currency: 'usd';
  rentalDays: number;
  dailyRateCents: number;
  rentalSubtotalCents: number;
  extrasSubtotalCents: number;
  operatorTaxesCents: number;
  /** Server-authoritative tax naming ("Tax", 7.5) — absent on pre-2026-08-17
   * quote shapes; renderers fall back to generic copy. */
  operatorTaxLabel?: string;
  operatorTaxRate?: number;
  operatorTotalCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  protectionDailyRateCents: number;
  protectionTotalCents: number;
  /** 2% Exotiq take + Stripe's fee on the Exotiq leg (server-computed). */
  processingFeeCents: number;
  /** Per-day state vehicle-rental surcharge (server-computed). */
  stateFeeCents: number;
  /** Server-authoritative name for the state fee line ("FL rental fee") —
   * absent on pre-2026-08-17 quote shapes; renderers fall back to a generic
   * label rather than guessing a jurisdiction. */
  stateFeeLabel?: string;
  exotiqTotalCents: number;
  grandTotalCents: number;
  depositHoldCents: number;
  cancellationPolicy: {
    freeCancellationHours: 72;
    platformFeeRefundableInWindow: true;
    protectionRefundableInWindow: true;
  };
};
/* ------------------------------------------------------------------ */
/* Marketplace (M7 / MP-2) — cross-tenant browse contracts.            */
/* Composed from the existing Operator/Vehicle domain types so a       */
/* listing is exactly "a vehicle, and the operator you'd book it from".*/
/* ------------------------------------------------------------------ */

export type MarketplaceSort = 'featured' | 'price_asc' | 'price_desc' | 'newest';

/** Filters live in the URL and nowhere else; this is the parsed, clamped form. */
export type MarketplaceQuery = {
  city?: string;
  state?: string;
  /** Structured make filter (exact, case-insensitive) — never a name-substring match. */
  makes: string[];
  /** Body-type slugs from the fixed vocabulary (MP-9); empty = any. */
  types: string[];
  minDailyRateCents?: number;
  maxDailyRateCents?: number;
  sort: MarketplaceSort;
  /** Hard-capped server-side; the RPC contract caps at 60 too. */
  limit: number;
  offset: number;
};

export type MarketplaceListing = {
  team: Operator;
  vehicle: Vehicle;
  photoCount: number;
  /** Exotiq Verified — rendered when the backend exposes it (VET-8); absent until then. */
  verified?: boolean;
};

export type MarketplaceFacetValue = { value: string; label: string; count: number };

export type MarketplaceFacets = {
  cities: MarketplaceFacetValue[];
  makes: MarketplaceFacetValue[];
  /** Only types at least one listed car carries; empty until tenants classify cars. */
  types: MarketplaceFacetValue[];
  priceBands: MarketplaceFacetValue[];
};

export type MarketplacePage = {
  listings: MarketplaceListing[];
  totalCount: number;
  limit: number;
  offset: number;
};
