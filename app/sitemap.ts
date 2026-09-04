import type { MetadataRoute } from 'next';
import { browseEnabled, getDataMode, siteUrl } from '@/domain/booking/config';
import { getMarketplaceListings, getPublicTeamStorefront } from '@/domain/booking/service';

/**
 * Sitemap per host (M7e / MP-6).
 *
 * - mock data (demo): empty — nothing fictitious gets submitted.
 * - browse on: /browse, every listed tenant's storefront, every listed car.
 *   Same catalog call the grid uses, so the sitemap can never disagree with
 *   the page (and under the fan-out it costs nothing extra: React.cache +
 *   the revalidate window).
 * - browse off (book.exotiq.rent before launch): the default tenant's
 *   storefront and fleet. Other tenants are reached by the links they share.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (getDataMode() !== 'supabase') return [];
  const base = siteUrl();
  const now = new Date();

  if (browseEnabled()) {
    const page = await getMarketplaceListings({ makes: [], types: [], sort: 'featured', limit: Number.MAX_SAFE_INTEGER, offset: 0 });
    const teams = new Map<string, string>();
    for (const { team } of page.listings) teams.set(team.slug, team.slug);
    return [
      { url: `${base}/browse`, lastModified: now, changeFrequency: 'daily', priority: 1 },
      ...Array.from(teams.keys()).map((slug) => ({ url: `${base}/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
      ...page.listings.map(({ team, vehicle }) => ({ url: `${base}/${team.slug}/${vehicle.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ];
  }

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG;
  if (!slug) return [];
  const storefront = await getPublicTeamStorefront(slug);
  if (!storefront) return [];
  return [
    { url: `${base}/${storefront.team.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...storefront.vehicles.map((vehicle) => ({ url: `${base}/${storefront.team.slug}/${vehicle.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
