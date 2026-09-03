import type { MetadataRoute } from 'next';
import { getDataMode, siteUrl } from './config';

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
