import type { BookingCart, ExtraSelection, Operator, Vehicle } from './types';
import { calculateBookingTotals } from './totals';

export const mockOperator: Operator = {
  id: 'team_desert_exotic_rentals',
  slug: 'desert-exotic-rentals',
  name: 'Desert Exotic Rentals',
  city: 'Scottsdale',
  state: 'AZ',
  phone: '+14805550142',
  logoUrl: '/images/logos/drive-exotiq-logo-white.png',
  timezone: 'America/Phoenix',
  platformFeePercent: 20,
};

export const mockVehicle: Vehicle = {
  id: 'veh_mclaren_750s_spider',
  slug: 'mclaren-750s-spider',
  operatorId: mockOperator.id,
  name: '2024 McLaren 750S Spider',
  shortName: 'McLaren 750S',
  year: 2024,
  make: 'McLaren',
  model: '750S Spider',
  dailyRateCents: 119900,
  minRentalDays: 3,
  photos: ['/images/vehicles/mclaren-750s.png'],
  heroImage: '/images/vehicles/mclaren-750s.png',
  specs: {
    zeroToSixty: '2.7s',
    power: '740 hp',
    engine: 'V8 twin-turbo',
    transmission: '7-speed SSG',
  },
  footnote: '3-day minimum · Unlimited miles included',
  pickupLocation: {
    id: 'loc_scottsdale_showroom',
    name: 'Scottsdale showroom',
    address: '7001 N Scottsdale Rd',
    city: 'Scottsdale',
    state: 'AZ',
    phone: mockOperator.phone,
  },
};

export const curatedExtras: ExtraSelection[] = [
  { id: 'delivery', name: 'Concierge delivery', description: 'Hotel, residence, or FBO handoff.', priceCents: 15000, unit: 'flat', defaultSelected: true },
  { id: 'driver', name: 'Additional driver', description: 'Pre-verified second driver.', priceCents: 9900, unit: 'day' },
  { id: 'photo', name: 'Photo package', description: 'Editorial handoff photos with the car.', priceCents: 25000, unit: 'flat' },
  { id: 'late-return', name: 'Late return', description: 'Extend return window up to 4 hours.', priceCents: 12500, unit: 'flat' },
];

export function createInitialCart(overrides: { operator?: Operator; vehicle?: Vehicle } = {}): BookingCart {
  const operator = overrides.operator ?? mockOperator;
  const vehicle = overrides.vehicle ?? mockVehicle;
  const selectedExtras = curatedExtras.filter((extra) => extra.defaultSelected);
  const dates = { start: '2026-06-14', end: '2026-06-17' };
  const protection = 'premium' as const;

  return {
    operator,
    vehicle,
    dates,
    pickupTime: '10:00 AM',
    driver: {
      name: 'Gregory James',
      dob: '1985-06-14',
      phone: '+13035550184',
      license: { fileId: 'mock-license', status: 'verified', thumbnailUrl: '/images/app/app-detail.png' },
      insurance: { status: 'empty' },
    },
    extras: selectedExtras,
    protection,
    totals: calculateBookingTotals({
      dailyRateCents: vehicle.dailyRateCents,
      startDate: dates.start,
      endDate: dates.end,
      extras: selectedExtras,
      protection,
      operatorTaxRate: 0.078,
    }),
  };
}

export function findMockVehicle(operatorSlug: string, vehicleSlug: string) {
  if (operatorSlug === mockOperator.slug && vehicleSlug === mockVehicle.slug) {
    return { operator: mockOperator, vehicle: mockVehicle };
  }
  return null;
}
