import { mockOperators, mockVehicles } from './mockData';
import { applyMarketplaceQuery, computeFacets, excludeBusy, listingKey } from './marketplaceCore';
import { busyRangeFor } from './marketplaceQuery';
import type { BusyResult, MarketplaceFacets, MarketplaceListing, MarketplacePage, MarketplaceQuery } from './publicContracts';

/**
 * Mock-mode marketplace (MP-2): every visible mock vehicle across every mock
 * operator, with the SAME filter/sort/paginate semantics the live path uses.
 * This is what lets the browse UI be built and reviewed with no backend.
 */
export function mockMarketplaceListings(): MarketplaceListing[] {
  const byId = new Map(mockOperators.map((op) => [op.id, op]));
  return mockVehicles
    .filter((vehicle) => !vehicle.hidden)
    .flatMap((vehicle) => {
      const team = byId.get(vehicle.operatorId);
      return team ? [{ team, vehicle, photoCount: vehicle.photos.length }] : [];
    });
}

/**
 * Mock busy set (MP-10) from each demo car's unavailableRanges. Those ranges
 * are inclusive of their last busy day (the date picker and the live adapter
 * read them that way), so a range overlaps the window when both ends touch.
 */
export async function getMockFleetBusy(window: { start: string; end: string }, teamSlug?: string): Promise<BusyResult> {
  const range = busyRangeFor(window);
  const busy = new Set<string>();
  for (const { team, vehicle } of mockMarketplaceListings()) {
    if (teamSlug && team.slug !== teamSlug) continue;
    for (const blocked of vehicle.unavailableRanges ?? []) {
      if (blocked.start <= range.end && blocked.end >= range.start) {
        busy.add(listingKey(team.slug, vehicle.slug));
        break;
      }
    }
  }
  return { busy, checked: true };
}

export async function getMockMarketplaceListings(query: MarketplaceQuery): Promise<MarketplacePage> {
  const catalog = mockMarketplaceListings();
  if (!query.start || !query.end) return applyMarketplaceQuery(catalog, query);
  const window = { start: query.start, end: query.end };
  const { busy, checked } = await getMockFleetBusy(window);
  return { ...applyMarketplaceQuery(excludeBusy(catalog, busy), query), availability: { ...window, checked } };
}

export async function getMockMarketplaceFacets(): Promise<MarketplaceFacets> {
  return computeFacets(mockMarketplaceListings());
}
