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