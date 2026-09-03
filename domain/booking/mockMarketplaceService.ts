import { mockOperators, mockVehicles } from './mockData';
import { applyMarketplaceQuery, computeFacets } from './marketplaceCore';
import type { MarketplaceFacets, MarketplaceListing, MarketplacePage, MarketplaceQuery } from './publicContracts';

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

export async function getMockMarketplaceListings(query: MarketplaceQuery): Promise<MarketplacePage> {
  return applyMarketplaceQuery(mockMarketplaceListings(), query);
}

export async function getMockMarketplaceFacets(): Promise<MarketplaceFacets> {
  return computeFacets(mockMarketplaceListings());
}
