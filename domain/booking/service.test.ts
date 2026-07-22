import { describe, expect, it } from 'vitest';
import { mockOperators, mockVehicles } from './mockData';
import { createRenterBooking, getBookingConfirmation, getPublicTeamStorefront, getPublicVehicleContext } from './service';
import { createInitialCart } from './mockData';

describe('booking service facade mock mode', () => {
  it('returns a public storefront with multiple vehicles for a known team', async () => {
    const storefront = await getPublicTeamStorefront('desert-exotic-rentals');

    expect(storefront?.team.name).toBe('Desert Exotic Rentals');
    expect(storefront?.vehicles.length).toBeGreaterThanOrEqual(3);
    expect(storefront?.vehicles.map((vehicle) => vehicle.slug)).toContain('mclaren-750s-spider');
  });

  it('returns null for unknown teams and vehicles', async () => {
    await expect(getPublicTeamStorefront('missing-team')).resolves.toBeNull();
    await expect(getPublicVehicleContext('desert-exotic-rentals', 'missing-car')).resolves.toBeNull();
  });

  it('resolves a vehicle only inside its owning team', async () => {
    const desertVehicle = await getPublicVehicleContext('desert-exotic-rentals', 'mclaren-750s-spider');
    const wrongTeam = await getPublicVehicleContext('mile-high-exotics', 'mclaren-750s-spider');

    expect(desertVehicle?.vehicle.shortName).toBe('McLaren 750S');
    expect(wrongTeam).toBeNull();
  });

  it('returns confirmation data by public booking ref shape', async () => {
    const confirmation = await getBookingConfirmation('BK-01001');

    expect(confirmation?.bookingRef).toBe('BK-01001');
    if (!confirmation || 'restricted' in confirmation) throw new Error('expected a full mock confirmation');
    expect(confirmation.team.slug).toBe('desert-exotic-rentals');
  });

  it('has a demo-sized catalog: 3 teams and 6+ visible vehicles with varied rates and minimums', async () => {
    expect(mockOperators.length).toBe(3);

    const storefronts = await Promise.all(mockOperators.map((team) => getPublicTeamStorefront(team.slug)));
    const visibleVehicles = storefronts.flatMap((storefront) => storefront?.vehicles ?? []);

    expect(visibleVehicles.length).toBeGreaterThanOrEqual(6);
    expect(new Set(visibleVehicles.map((vehicle) => vehicle.dailyRateCents)).size).toBeGreaterThan(3);
    expect(new Set(visibleVehicles.map((vehicle) => vehicle.minRentalDays)).size).toBeGreaterThan(1);
    expect(visibleVehicles.some((vehicle) => (vehicle.unavailableRanges?.length ?? 0) > 0)).toBe(true);
    expect(visibleVehicles.every((vehicle) => vehicle.photos.length >= 2)).toBe(true);
  });

  it('creates a mock booking with the demo ref and pending_documents status (V1 ruling)', async () => {
    const result = await createRenterBooking(createInitialCart());
    expect(result.bookingRef).toBe('BK-01001');
    expect(result.status).toBe('pending_documents');
    expect(result.confirmationToken).toBeUndefined();
  });

  it('never exposes hidden vehicles through the storefront or by slug', async () => {
    const hidden = mockVehicles.find((vehicle) => vehicle.hidden);
    expect(hidden).toBeDefined();

    const team = mockOperators.find((operator) => operator.id === hidden?.operatorId);
    const storefront = await getPublicTeamStorefront(team!.slug);

    expect(storefront?.vehicles.map((vehicle) => vehicle.slug)).not.toContain(hidden!.slug);
    await expect(getPublicVehicleContext(team!.slug, hidden!.slug)).resolves.toBeNull();
  });
});
