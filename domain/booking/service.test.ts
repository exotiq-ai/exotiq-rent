import { describe, expect, it } from 'vitest';
import { getBookingConfirmation, getPublicTeamStorefront, getPublicVehicleContext } from './service';

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
    expect(confirmation?.team.slug).toBe('desert-exotic-rentals');
  });
});
