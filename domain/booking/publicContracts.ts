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