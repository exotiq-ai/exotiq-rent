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
  deliveryFeeCents?: number;
  mileagePackageCents?: number;
  operatorFeesCents?: number;
  depositHoldCents?: number;
  exotiqPlatformFeeCents?: number;
  protectionPremiumCents?: number;
  operatorChargeCents: number;
  exotiqChargeCents: number;
  totalDueTodayCents: number;
};
