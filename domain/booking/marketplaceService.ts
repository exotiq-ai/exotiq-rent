import { cache } from 'react';
import { adaptFleetVehicle, adaptTeam } from './adapters';
import { applyMarketplaceQuery, computeFacets } from './marketplaceCore';
import { fetchPublicTeam, fetchPublicTeamFleet } from './rpcClient';
import type { MarketplaceFacets, MarketplaceListing, MarketplacePage, MarketplaceQuery } from './publicContracts';

/**
 * Supabase-mode marketplace via fan-out (MP-4 / M7c).
 *
 * No cross-tenant read RPC exists yet (verified 2026-08-21: both
 * public_marketplace_fleet and public_marketplace_teams are PGRST202), so the
 * grid is assembled from the per-tenant reads that already power the
 * storefronts. The tenant list is a server-only env var — the same visibility
 * gating the RPCs enforce still applies per tenant, this just names which
 * storefronts the grid unions. Each tenant fetch runs in parallel under the
 * existing `revalidate: 300` cache, so the cost is N calls per revalidation
 * window from the server, never per pageview from renters. A failing tenant
 * degrades (skipped, logged) rather than failing the page.
 *
 * When Lovable ships `public_marketplace_fleet` (M7f / MP-7), `loadCatalog`
 * is the one function body that changes.
 */

const perRequest: typeof cache = typeof cache === 'function' ? cache : (fn) => fn;

export function configuredMarketplaceTeamSlugs(): string[] {
  // Deduped: a slug listed twice would double every listing and facet count.
  return Array.from(
    new Set(
      (process.env.MARKETPLACE_TEAM_SLUGS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

async function loadTenant(slug: string): Promise<MarketplaceListing[]> {
  try {
    const teamRow = await fetchPublicTeam(slug);
    if (!teamRow) return [];
    const team = adaptTeam(teamRow);
    const fleet = await fetchPublicTeamFleet(slug);
    // Same quality gate as the storefront grid: a car without a hero image
    // would render as a blank card, so it stays off the marketplace too.
    return fleet
      .filter((row) => Boolean(row.hero_image_url))
      .map((row) => ({
        team,
        vehicle: adaptFleetVehicle(row, team),
        // The fleet RPC exposes one hero image, not a count; the real
        // photo_count arrives with the M7f RPC. Until then 'featured' falls
        // through to its price tiebreak, which is the documented ordering.
        photoCount: 1,
      }));
  } catch (error) {
    console.error(`[marketplace] tenant "${slug}" skipped:`, error instanceof Error ? error.message : error);
    return [];
  }
}

// One fan-out per request even though listings and facets both need the
// catalog — React.cache dedupes within the render.
const loadCatalog = perRequest(async (): Promise<MarketplaceListing[]> => {
  const perTenant = await Promise.all(configuredMarketplaceTeamSlugs().map(loadTenant));
  return perTenant.flat();
});

export async function getSupabaseMarketplaceListings(query: MarketplaceQuery): Promise<MarketplacePage> {
  return applyMarketplaceQuery(await loadCatalog(), query);
}

export async function getSupabaseMarketplaceFacets(): Promise<MarketplaceFacets> {
  return computeFacets(await loadCatalog());
}
