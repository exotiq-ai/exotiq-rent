import type { BookingCart, ExtraSelection, Operator, Vehicle } from './types';
import { calculateBookingTotals } from './totals';

export const mockOperators: Operator[] = [
  {
    id: 'team_desert_exotic_rentals',
    slug: 'desert-exotic-rentals',
    name: 'Desert Exotic Rentals',
    city: 'Scottsdale',
    state: 'AZ',
    phone: '+14805550142',
    logoUrl: '/images/logos/drive-exotiq-logo-white.png',
    timezone: 'America/Phoenix',
    platformFeePercent: 10,
  },
  {
    id: 'team_mile_high_exotics',
    slug: 'mile-high-exotics',
    name: 'Mile High Exotics',
    city: 'Denver',
    state: 'CO',
    phone: '+17205550177',
    logoUrl: '/images/logos/drive-exotiq-logo-white.png',
    timezone: 'America/Denver',
    platformFeePercent: 10,
  },
];

export const mockOperator = mockOperators[0];

export const mockVehicles: Vehicle[] = [
  {
    id: 'veh_mclaren_750s_spider',
    slug: 'mclaren-750s-spider',
    operatorId: mockOperators[0].id,
    name: '2024 McLaren 750S Spider',
    shortName: 'McLaren 750S',
    year: 2024,
    make: 'McLaren',
    model: '750S Spider',
    dailyRateCents: 119900,
    minRentalDays: 3,
    photos: ['/images/vehicles/mclaren-750s.png', '/images/app/app-detail.png'],
    heroImage: '/images/vehicles/mclaren-750s.png',
    specs: { zeroToSixty: '2.7s', power: '740 hp', engine: 'V8 twin-turbo', transmission: '7-speed SSG' },
    footnote: '3-day minimum · Unlimited miles included',
    pickupLocation: { id: 'loc_scottsdale_showroom', name: 'Scottsdale showroom', address: '7001 N Scottsdale Rd', city: 'Scottsdale', state: 'AZ', phone: mockOperators[0].phone },
  },
  {
    id: 'veh_lamborghini_huracan_evo',
    slug: 'lamborghini-huracan-evo',
    operatorId: mockOperators[0].id,
    name: '2023 Lamborghini Huracán EVO',
    shortName: 'Huracán EVO',
    year: 2023,
    make: 'Lamborghini',
    model: 'Huracán EVO',
    dailyRateCents: 99900,
    minRentalDays: 2,
    photos: ['/images/vehicles/mclaren-750s.png', '/images/app/app-detail.png'],
    heroImage: '/images/vehicles/mclaren-750s.png',
    specs: { zeroToSixty: '2.9s', power: '631 hp', engine: 'V10 naturally aspirated', transmission: '7-speed dual-clutch' },
    footnote: '2-day minimum · 150 miles/day included',
    pickupLocation: { id: 'loc_scottsdale_showroom', name: 'Scottsdale showroom', address: '7001 N Scottsdale Rd', city: 'Scottsdale', state: 'AZ', phone: mockOperators[0].phone },
  },
  {
    id: 'veh_ferrari_f8_spider',
    slug: 'ferrari-f8-spider',
    operatorId: mockOperators[0].id,
    name: '2022 Ferrari F8 Spider',
    shortName: 'Ferrari F8',
    year: 2022,
    make: 'Ferrari',
    model: 'F8 Spider',
    dailyRateCents: 109900,
    minRentalDays: 3,
    photos: ['/images/vehicles/mclaren-750s.png', '/images/app/app-detail.png'],
    heroImage: '/images/vehicles/mclaren-750s.png',
    specs: { zeroToSixty: '2.9s', power: '710 hp', engine: 'V8 twin-turbo', transmission: '7-speed F1 DCT' },
    footnote: '3-day minimum · Concierge handoff available',
    pickupLocation: { id: 'loc_scottsdale_showroom', name: 'Scottsdale showroom', address: '7001 N Scottsdale Rd', city: 'Scottsdale', state: 'AZ', phone: mockOperators[0].phone },
  },
  {
    id: 'veh_porsche_911_turbo_s',
    slug: 'porsche-911-turbo-s',
    operatorId: mockOperators[1].id,
    name: '2024 Porsche 911 Turbo S',
    shortName: '911 Turbo S',
    year: 2024,
    make: 'Porsche',
    model: '911 Turbo S',
    dailyRateCents: 69900,
    minRentalDays: 2,
    photos: ['/images/vehicles/mclaren-750s.png', '/images/app/app-detail.png'],
    heroImage: '/images/vehicles/mclaren-750s.png',
    specs: { zeroToSixty: '2.6s', power: '640 hp', engine: 'Flat-six twin-turbo', transmission: '8-speed PDK' },
    footnote: '2-day minimum · Mountain routes available',
    pickupLocation: { id: 'loc_denver_showroom', name: 'Denver showroom', address: '2500 Walnut St', city: 'Denver', state: 'CO', phone: mockOperators[1].phone },
  },
];

export const mockVehicle = mockVehicles[0];

export const curatedExtras: ExtraSelection[] = [
  { id: 'delivery', name: 'Concierge delivery', description: 'We bring it to your hotel · 25-mile radius', priceCents: 15000, unit: 'flat', defaultSelected: true },
  { id: 'driver', name: 'Additional driver', description: 'Second verified driver on the rental.', priceCents: 4500, unit: 'day' },
  { id: 'photo', name: 'Photo package', description: '90-minute shoot · 30 edited images.', priceCents: 40000, unit: 'flat' },
  { id: 'late-return', name: 'Late return', description: 'Until 6 PM on the final day.', priceCents: 7500, unit: 'flat' },
];

export function createInitialCart(overrides: { operator?: Operator; vehicle?: Vehicle } = {}): BookingCart {
  const vehicle = overrides.vehicle ?? mockVehicle;
  const operator = overrides.operator ?? mockOperators.find((team) => team.id === vehicle.operatorId) ?? mockOperator;
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
      platformFeeRate: (operator.platformFeePercent ?? 10) / 100,
    }),
  };
}
