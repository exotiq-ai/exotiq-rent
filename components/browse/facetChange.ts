// MP-36: which facet a storefront bar submission changes, by NAME only — the one property facet_applied carries.
// Pure, no React, no values ever leave this function (the sanitizer in components/analytics/policy.ts keeps only
// these four names anyway). Compares the form's URLSearchParams (as navigate() builds them: empty values and
// sort=featured already dropped) with the page's parsed query, in the bar's reading order.
import { PRICE_BANDS } from '@/domain/booking/marketplaceQuery';
import type { MarketplaceQuery } from '@/domain/booking/publicContracts';

export type AppliedFacet = 'dates' | 'sort' | 'make' | 'band';

/** The band slug the query's min/max spell, '' when they match none — the same derivation as the bar's currentBand. */
const bandOf = (query: MarketplaceQuery): string =>
  PRICE_BANDS.find((b) => b.minCents === (query.minDailyRateCents ?? 0) && b.maxCents === query.maxDailyRateCents)?.value ?? '';
/** Lower-cased, deduped, sorted: a set compare (the URL may repeat a make; the bar carries it once — fix round 2 N10). */
const normalised = (values: string[]): string[] => Array.from(new Set(values.map((v) => v.toLowerCase()))).sort();
const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** The first facet, in dates → sort → make → band order, that the submission changes; null when none (a type-only change is none: A2). */
export function changedFacet(query: MarketplaceQuery, submitted: URLSearchParams): AppliedFacet | null {
  if ((submitted.get('start') ?? '') !== (query.start ?? '') || (submitted.get('end') ?? '') !== (query.end ?? '')) return 'dates';
  if ((submitted.get('sort') ?? 'featured') !== query.sort) return 'sort';
  if (!sameSet(normalised(submitted.getAll('make')), normalised(query.makes))) return 'make';
  if ((submitted.get('band') ?? '') !== bandOf(query)) return 'band';
  return null;
}

/** Two searches that spell the same query, whatever their order or leading `?`. */
export const sameSearch = (a: string, b: string): boolean => {
  const key = (s: string) => Array.from(new URLSearchParams(s).entries()).map(([k, v]) => `${k}=${v}`).sort().join('&');
  return key(a) === key(b);
};

/**
 * MP-36 fix round (F3): one gesture, one navigation. The gate remembers the last search it allowed and refuses a
 * repeat of it — a date commit followed by Enter calls navigate() twice before the keyed remount — and, until a
 * push is in flight, refuses the document's own search, so an unchanged submit never pushes the page onto itself
 * or emits an event. Fix round 2 (F7): once a push is pending the document's search is stale, so the last push is
 * what the next search is measured against — a reversal (B, then back to A) navigates instead of being swallowed.
 */
export function createNavigationGate(): (next: string, current: string) => boolean {
  let last: string | null = null;
  return (next, current) => {
    const against = last ?? current;
    if (sameSearch(next, against)) return false;
    last = next;
    return true;
  };
}
