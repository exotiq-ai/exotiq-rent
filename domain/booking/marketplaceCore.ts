import type { MarketplaceFacets, MarketplaceListing, MarketplacePage, MarketplaceQuery } from './publicContracts';
import { PRICE_BANDS } from './marketplaceQuery';

/**
 * Pure filter / sort / paginate / facet logic over listings (MP-2).
 *
 * Shared by the mock service and the live fan-out (M7c) so the two modes can
 * never disagree about what a filter means. When the single RPC lands (M7f)
 * this moves server-side, and these functions become the contract tests for
 * it.
 */

const norm = (s: string) => s.trim().toLowerCase();

export function filterListings(listings: MarketplaceListing[], query: MarketplaceQuery): MarketplaceListing[] {
  const makes = new Set(query.makes.map(norm));
  return listings.filter(({ team, vehicle }) => {
    if (query.city && norm(team.city) !== norm(query.city)) return false;
    if (query.state && norm(team.state) !== norm(query.state)) return false;
    if (makes.size > 0 && !makes.has(norm(vehicle.make))) return false;
    if (query.minDailyRateCents !== undefined && vehicle.dailyRateCents < query.minDailyRateCents) return false;
    if (query.maxDailyRateCents !== undefined && vehicle.dailyRateCents > query.maxDailyRateCents) return false;
    return true;
  });
}

export function sortListings(listings: MarketplaceListing[], sort: MarketplaceQuery['sort']): MarketplaceListing[] {
  const copy = listings.slice();
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => a.vehicle.dailyRateCents - b.vehicle.dailyRateCents || a.vehicle.name.localeCompare(b.vehicle.name));
    case 'price_desc':
      return copy.sort((a, b) => b.vehicle.dailyRateCents - a.vehicle.dailyRateCents || a.vehicle.name.localeCompare(b.vehicle.name));
    case 'newest':
      return copy.sort((a, b) => b.vehicle.year - a.vehicle.year || a.vehicle.name.localeCompare(b.vehicle.name));
    case 'featured':
    default:
      // Published ranking (decisions log 2026-08-21): Verified first, then
      // listing quality (photo count), then price — applied identically to
      // every operator, Exotiq's own fleet included.
      return copy.sort(
        (a, b) =>
          Number(Boolean(b.verified)) - Number(Boolean(a.verified)) ||
          b.photoCount - a.photoCount ||
          b.vehicle.dailyRateCents - a.vehicle.dailyRateCents ||
          a.vehicle.name.localeCompare(b.vehicle.name),
      );
  }
}

export function paginateListings(listings: MarketplaceListing[], query: MarketplaceQuery): MarketplacePage {
  return {
    listings: listings.slice(query.offset, query.offset + query.limit),
    totalCount: listings.length,
    limit: query.limit,
    offset: query.offset,
  };
}

export function applyMarketplaceQuery(listings: MarketplaceListing[], query: MarketplaceQuery): MarketplacePage {
  return paginateListings(sortListings(filterListings(listings, query), query.sort), query);
}

/** Facet counts over the FULL catalog, so every option shows what choosing it yields. */
export function computeFacets(listings: MarketplaceListing[]): MarketplaceFacets {
  // Keyed the way the filter compares (case-insensitive), and cities by
  // city+state so two same-named cities in different states stay two facets.
  // The make label keeps the first spelling seen so "McLaren" and "MCLAREN"
  // from two tenants count as one make instead of two rows.
  const cities = new Map<string, { value: string; label: string; count: number }>();
  const makes = new Map<string, { label: string; count: number }>();
  for (const { team, vehicle } of listings) {
    const cityKey = `${norm(team.city)}|${norm(team.state)}`;
    const city = cities.get(cityKey) ?? { value: team.city, label: `${team.city}, ${team.state}`, count: 0 };
    city.count += 1;
    cities.set(cityKey, city);
    const makeKey = norm(vehicle.make);
    const make = makes.get(makeKey) ?? { label: vehicle.make, count: 0 };
    make.count += 1;
    makes.set(makeKey, make);
  }
  return {
    cities: Array.from(cities.values())
      .map(({ value, label, count }) => ({ value, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    makes: Array.from(makes.values())
      .map(({ label, count }) => ({ value: label, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    priceBands: PRICE_BANDS.map((band) => ({
      value: band.value,
      label: band.label,
      count: listings.filter(
        ({ vehicle }) => vehicle.dailyRateCents >= band.minCents && (band.maxCents === undefined || vehicle.dailyRateCents <= band.maxCents),
      ).length,
    })),
  };
}
