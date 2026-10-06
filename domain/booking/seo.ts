import type { MetadataRoute } from 'next';
import { getDataMode, siteUrl } from './config';
import { formatMoney } from './totals';
import type { Operator, Vehicle } from './types';

/**
 * Per-host crawl policy (M7e / MP-6). Pure so it is testable; app/robots.ts
 * is the one-line route that serves it.
 *
 * Keyed on the DATA mode, not the browse flag: demo.exotiq.rent runs on mock
 * data and must never be indexed — three fictitious operators would outrank
 * the real ones — while book.exotiq.rent's live storefronts are real pages
 * whether or not /browse is on (it 404s when off, so nothing to disallow).
 * Renter-private surfaces stay out of every index.
 */
export function robotsPolicy(): MetadataRoute.Robots {
  if (getDataMode() !== 'supabase') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/verify', '/booking/', '/share/', '/preview'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

/** The branded floor card (app/opengraph-image.tsx): what unfurls when a page has no better image. */
export const FLOOR_CARD = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Drive Exotiq' } as const;

export type UnfurlImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The link-preview image list for a page with its own openGraph (MP-18). Next 14.2's mergeMetadata
 * REPLACES the root layout's whole openGraph block in such a page, file-based card included, and
 * an explicit `images` key (even []) blocks any fallback. So the list is never empty: the hero when
 * it is a usable https or root-relative URL (resolved through metadataBase), else the floor card.
 */
export function unfurlImages(hero: string | null | undefined): UnfurlImage[] {
  if (typeof hero === 'string' && hero !== '' && !/\s/.test(hero)) {
    const rootRelative = hero.startsWith('/') && !hero.startsWith('//') && !hero.startsWith('/\\');
    let https = false;
    if (hero.startsWith('https://')) {
      try {
        https = new URL(hero).hostname !== '';
      } catch {
        https = false;
      }
    }
    if (rootRelative || https) return [{ url: hero }];
  }
  return [{ ...FLOOR_CARD }];
}

/** A storefront link unfurls as that operator, with the first car the page shows (AC4). */
export function storefrontOpenGraph(team: Pick<Operator, 'name' | 'city' | 'state'>, hero: string | null | undefined) {
  return {
    title: `${team.name} | Drive Exotiq`,
    description: `Book exotic rentals from ${team.name} in ${team.city}, ${team.state}.`,
    siteName: 'Drive Exotiq',
    type: 'website' as const,
    images: unfurlImages(hero),
  };
}

/** A vehicle link unfurls as that car: today's title and description, plus site name, type and a never-empty image list (AC5). */
export function vehicleOpenGraph(team: Pick<Operator, 'city' | 'state'>, vehicle: Pick<Vehicle, 'name' | 'dailyRateCents' | 'heroImage'>) {
  return {
    title: `${vehicle.name} | Drive Exotiq`,
    description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${team.city}, ${team.state}.`,
    siteName: 'Drive Exotiq',
    type: 'website' as const,
    images: unfurlImages(vehicle.heroImage),
  };
}
