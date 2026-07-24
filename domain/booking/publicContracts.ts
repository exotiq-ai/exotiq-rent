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
  operatorTotalCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  protectionDailyRateCents: number;
  protectionTotalCents: number;
  exotiqTotalCents: number;
  grandTotalCents: number;
  depositHoldCents: number;
  cancellationPolicy: {
    freeCancellationHours: 72;
    platformFeeRefundableInWindow: true;
    protectionRefundableInWindow: true;
  };
};