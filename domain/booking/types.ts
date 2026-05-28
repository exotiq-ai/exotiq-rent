export type ProtectionTier = 'premium' | 'standard' | 'decline';
export type ExtraUnit = 'flat' | 'day';
export type VerificationStatus = 'empty' | 'pending' | 'verified' | 'rejected';

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
};

export type PickupLocation = {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
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
  photos: string[];
  heroImage: string;
  specs: {
    zeroToSixty: string;
    power: string;
    engine: string;
    transmission: string;
  };
  footnote: string;
  pickupLocation: PickupLocation;
};

export type ExtraSelection = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  unit: ExtraUnit;
  defaultSelected?: boolean;
};

export type DriverDocument = {
  fileId?: string;
  status: VerificationStatus;
  thumbnailUrl?: string;
};

export type Driver = {
  name: string;
  dob: string;
  phone: string;
  license: DriverDocument;
  insurance: DriverDocument;
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
