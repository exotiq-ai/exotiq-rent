import { cache } from 'react';
import { adaptFleetVehicle, adaptTeam, publicImageUrl } from './adapters';
import { applyMarketplaceQuery, computeFacets, excludeBusy, listingKey } from './marketplaceCore';
import { busyRangeFor } from './marketplaceQuery';
import { fetchFleetBusy, fetchMarketplaceFleet, fetchMarketplaceTeams, type RpcMarketplaceFleetRow, type RpcMarketplaceTeamRow } from './rpcClient';
import type { BusyResult, MarketplaceFacets, MarketplaceListing, MarketplacePage, MarketplaceQuery } from './publicContracts';

/**
 * Supabase-mode marketplace catalog (MP-7 / M7f).
 *
 * Two zero-argument public RPCs (Lovable, 2026-09-03): public_marketplace_teams()
 * lists the tenants that opted in through the Command Center toggle
 * (teams.marketplace_listed) AND pass the storefront visibility rule;
 * public_marketplace_fleet() lists their cars through the same predicates the
 * storefront grid applies, minus unlisted vehicles. Both ride the rpc()
 * revalidate window (300s), so the grid costs two calls per window from the
 * server, never per pageview.
 *
 * The two reads are one unit: if either fails, the grid shows its empty state
 * for that window (logged) rather than half a catalog. A tenant no longer
 * needs an env var or a redeploy to appear — the M7c fan-out and
 * MARKETPLACE_TEAM_SLUGS are gone.
 */

const perRequest: typeof cache = typeof cache === 'function' ? cache : (fn) => fn;

/** Pure join of the two RPC results into listings. Exported for tests. */
export function buildCatalog(teamRows: RpcMarketplaceTeamRow[], fleetRows: RpcMarketplaceFleetRow[]): MarketplaceListing[] {
  const teams = new Map(teamRows.map((row) => [row.slug, { operator: adaptTeam(row), verified: row.verified === true }]));
  const listings: MarketplaceListing[] = [];
  for (const row of fleetRows) {
    const team = teams.get(row.team_slug);
    if (!team) {
      // The two calls are separate statements, not one snapshot: a tenant
      // toggled between them can yield fleet rows with no team. Drop, don't throw.
      console.warn(`[marketplace] fleet row "${row.vehicle_slug}" has no listed team "${row.team_slug}" — skipped`);
      continue;
    }
    // The adapter's rule: only an absolute https hero renders (relative
    // Command-Center paths become ''), and a hero-less card is a blank card,
    // so such cars stay off the marketplace. Stricter than the storefront's
    // Boolean(hero_image_url) gate on purpose.
    if (!publicImageUrl(row.hero_image_url)) continue;
    listings.push({
      team: team.operator,
      vehicle: adaptFleetVehicle(row, team.operator),
      // A listing here always has a hero, so its photo count is at least 1
      // whatever the RPC counted (0 when the hero is the legacy image_url).
      photoCount: Math.max(1, Number(row.photo_count ?? 1) || 1),
      // Verified is an operator-level program: the team row is the source;
      // the fleet copy is a denormalisation that may only add.
      verified: team.verified || row.verified === true,
    });
  }
  // Deterministic order before the core sorts: facet labels keep the first
  // spelling seen, and the RPCs carry no ORDER BY by design.
  return listings.sort((a, b) => a.team.slug.localeCompare(b.team.slug) || a.vehicle.slug.localeCompare(b.vehicle.slug));
}

// One pair of reads per request even though listings and facets both need the
// catalog — React.cache dedupes within the render.
const loadCatalog = perRequest(async (): Promise<MarketplaceListing[]> => {
  try {
    const [teamRows, fleetRows] = await Promise.all([fetchMarketplaceTeams(), fetchMarketplaceFleet()]);
    return buildCatalog(teamRows, fleetRows);
  } catch (error) {
    console.error('[marketplace] catalog unavailable this window:', error instanceof Error ? error.message : error);
    return [];
  }
});

/**
 * Busy cars for a window (MP-10), fleet-wide or one storefront. One uncached
 * call; on failure the caller shows every car and says availability was not
 * checked — never a silent "all available".
 */
export async function getSupabaseFleetBusy(window: { start: string; end: string }, teamSlug?: string): Promise<BusyResult> {
  const range = busyRangeFor(window);
  try {
    const rows = await fetchFleetBusy(range.start, range.end, teamSlug);
    return { busy: new Set(rows.map((r) => listingKey(r.team_slug, r.vehicle_slug))), checked: true };
  } catch (error) {
    console.error('[marketplace] availability check failed:', error instanceof Error ? error.message : error);
    return { busy: new Set(), checked: false };
  }
}

export async function getSupabaseMarketplaceListings(query: MarketplaceQuery): Promise<MarketplacePage> {
  const catalog = await loadCatalog();
  if (!query.start || !query.end) return applyMarketplaceQuery(catalog, query);
  const window = { start: query.start, end: query.end };
  const { busy, checked } = await getSupabaseFleetBusy(window);
  return { ...applyMarketplaceQuery(excludeBusy(catalog, busy), query), availability: { ...window, checked } };
}

export async function getSupabaseMarketplaceFacets(): Promise<MarketplaceFacets> {
  return computeFacets(await loadCatalog());
}
