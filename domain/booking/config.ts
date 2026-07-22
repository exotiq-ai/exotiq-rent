/**
 * Data-mode switch (M4 architecture, introduced for identity live mode).
 *
 * Mock is the default and requires NO environment — the demo depends on it.
 * `supabase` mode is explicit opt-in and needs all three public env vars;
 * anything missing falls back to mock so a misconfigured deploy degrades to
 * the working demo instead of a broken live surface.
 */

export type DataMode = 'mock' | 'supabase';

/**
 * Which product a deploy serves (URL split, 2026-07-22):
 * - `booking` (default): the Gold booking flow — root redirects to the demo
 *   storefront. Runs at book.exotiq.rent.
 * - `marketplace`: the public marketing/marketplace mockup at the root, with
 *   the entire booking flow unrouteable (branded 404). Runs at exotiq.rent
 *   until the marketplace gets the gold treatment and booking goes live.
 */
export type SiteMode = 'booking' | 'marketplace';

export function getSiteMode(): SiteMode {
  return process.env.NEXT_PUBLIC_SITE_MODE === 'marketplace' ? 'marketplace' : 'booking';
}

export function getDataMode(): DataMode {
  if (process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE !== 'supabase') return 'mock';
  if (!getSupabaseUrl() || !getSupabaseAnonKey() || !getStripePublishableKey()) return 'mock';
  return 'supabase';
}

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
}

export function getFunctionsBaseUrl(): string {
  const base = getSupabaseUrl().replace(/\/$/, '');
  return base ? `${base}/functions/v1` : '';
}
