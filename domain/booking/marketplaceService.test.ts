import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RpcMarketplaceFleetRow, RpcMarketplaceTeamRow } from './rpcClient';

vi.mock('./rpcClient', () => ({
  fetchMarketplaceTeams: vi.fn(),
  fetchMarketplaceFleet: vi.fn(),
}));

import { fetchMarketplaceFleet, fetchMarketplaceTeams } from './rpcClient';
import { buildCatalog, getSupabaseMarketplaceFacets, getSupabaseMarketplaceListings } from './marketplaceService';
import { parseMarketplaceQuery } from './marketplaceQuery';

// Plan-shaped fixtures: exactly the columns Lovable's M7f RPCs return.
const teams: RpcMarketplaceTeamRow[] = [
  { slug: 'exotiq', name: 'Exotiq', logo_url: null, city: 'Scottsdale', state: 'AZ', timezone: 'America/Phoenix', verified: false },
  { slug: 'exotics-by-the-bay', name: 'Exotics By The Bay', logo_url: null, city: 'Tampa', state: 'FL', timezone: 'America/New_York', verified: true },
];
const car = (over: Partial<RpcMarketplaceFleetRow>): RpcMarketplaceFleetRow => ({
  vehicle_slug: 'x', name: 'Car', make: 'Make', model: 'M', year: 2024, color: null, daily_rate: 1000, hero_image_url: 'https://cdn/x.jpg', min_rental_days: 1,
  team_slug: 'exotiq', photo_count: 0, verified: false, ...over,
});

describe('buildCatalog (MP-7 join)', () => {
  it('joins fleet rows to their listed team and keeps the storefront hero gate', () => {
    const out = buildCatalog(teams, [
      car({ vehicle_slug: 'b', team_slug: 'exotiq', photo_count: 3 }),
      car({ vehicle_slug: 'a', team_slug: 'exotics-by-the-bay', photo_count: 0 }),
      car({ vehicle_slug: 'relative-hero', hero_image_url: '/lovable-uploads/x.png' }),
      car({ vehicle_slug: 'no-hero', hero_image_url: null }),
    ]);
    expect(out.map((l) => `${l.team.slug}/${l.vehicle.slug}`)).toEqual(['exotics-by-the-bay/a', 'exotiq/b']);
    expect(out[1].photoCount).toBe(3);
    expect(out[0].photoCount).toBe(1); // has a hero, so at least one photo whatever the RPC counted
    expect(out[0].team.city).toBe('Tampa');
    expect(out[1].vehicle.dailyRateCents).toBe(100000);
  });

  it('drops a fleet row whose team is not in the teams result, with a warning, instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = buildCatalog(teams, [car({ vehicle_slug: 'orphan', team_slug: 'fredo-d-lima' })]);
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('takes verified from the team row; the fleet copy can only add', () => {
    const out = buildCatalog(teams, [
      car({ vehicle_slug: 'a', team_slug: 'exotics-by-the-bay', verified: false }),
      car({ vehicle_slug: 'b', team_slug: 'exotiq', verified: false }),
      car({ vehicle_slug: 'c', team_slug: 'exotiq', verified: true }),
    ]);
    expect(out.map((l) => [l.vehicle.slug, l.verified])).toEqual([['a', true], ['b', false], ['c', true]]);
  });

  it('orders deterministically by team then vehicle so facet labels are stable', () => {
    const shuffled = [car({ vehicle_slug: 'z' }), car({ vehicle_slug: 'a', team_slug: 'exotics-by-the-bay' }), car({ vehicle_slug: 'm' })];
    const a = buildCatalog(teams, shuffled).map((l) => l.vehicle.slug);
    const b = buildCatalog(teams, [...shuffled].reverse()).map((l) => l.vehicle.slug);
    expect(a).toEqual(b);
    expect(a).toEqual(['a', 'm', 'z']);
  });
});

describe('supabase marketplace service', () => {
  beforeEach(() => {
    vi.mocked(fetchMarketplaceTeams).mockReset();
    vi.mocked(fetchMarketplaceFleet).mockReset();
  });

  it('serves listings and facets from the two RPCs with no tenant env var', async () => {
    vi.mocked(fetchMarketplaceTeams).mockResolvedValue(teams);
    vi.mocked(fetchMarketplaceFleet).mockResolvedValue([
      car({ vehicle_slug: 'a', team_slug: 'exotiq', make: 'Ferrari' }),
      car({ vehicle_slug: 'b', team_slug: 'exotics-by-the-bay', make: 'Lamborghini', daily_rate: '2500' }),
    ]);
    const page = await getSupabaseMarketplaceListings(parseMarketplaceQuery({ city: 'tampa' }));
    expect(page.totalCount).toBe(1);
    expect(page.listings[0].vehicle.dailyRateCents).toBe(250000);
    const facets = await getSupabaseMarketplaceFacets();
    expect(facets.cities.map((c) => c.label).sort()).toEqual(['Scottsdale, AZ', 'Tampa, FL']);
    expect(process.env.MARKETPLACE_TEAM_SLUGS).toBeUndefined();
  });

  it('degrades to an empty catalog, not an error, when either RPC fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchMarketplaceTeams).mockRejectedValue(new Error('public_marketplace_teams failed (500)'));
    vi.mocked(fetchMarketplaceFleet).mockResolvedValue([car({})]);
    const page = await getSupabaseMarketplaceListings(parseMarketplaceQuery());
    expect(page).toMatchObject({ listings: [], totalCount: 0 });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
