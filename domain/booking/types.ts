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
  phone: string;
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
  /** Busy ranges the renter cannot select. Mirrors the future get_vehicle_availability RPC shape. */
  unavailableRanges?: UnavailableDateRange[];
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
