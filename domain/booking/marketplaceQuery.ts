import type { MarketplaceQuery, MarketplaceSort } from './publicContracts';

/**
 * The single source of truth for searchParams ⇄ MarketplaceQuery (MP-2).
 *
 * Every filter control writes to the URL and this module reads it back, so a
 * filtered grid is always a shareable link and never client state. Values
 * are whitelisted/clamped here so nothing downstream (mock or RPC) has to
 * defend against a hand-edited URL.
 */

export const MARKETPLACE_SORTS: readonly MarketplaceSort[] = ['featured', 'price_asc', 'price_desc', 'newest'];
export const MARKETPLACE_DEFAULT_LIMIT = 24;
export const MARKETPLACE_MAX_LIMIT = 60;

/** Price bands shown as facets. Boundaries in cents; `max` undefined = open-ended. */
export const PRICE_BANDS: ReadonlyArray<{ value: string; label: string; minCents: number; maxCents?: number }> = [
  { value: 'under-500', label: 'Under $500/day', minCents: 0, maxCents: 49_999 },
  { value: '500-999', label: '$500 – $999', minCents: 50_000, maxCents: 99_999 },
  { value: '1000-1999', label: '$1,000 – $1,999', minCents: 100_000, maxCents: 199_999 },
  { value: '2000-plus', label: '$2,000 and up', minCents: 200_000 },
];

/**
 * Vehicle body types (MP-9). The slugs are the DB vocabulary — the check
 * constraint on vehicles.body_type lists exactly these — and the labels are
 * what renters see. An unknown slug in a URL simply matches nothing.
 */
export const BODY_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'hypercar', label: 'Hypercar' },
  { value: 'supercar', label: 'Supercar' },
  { value: 'sports-car', label: 'Sports car' },
  { value: 'grand-tourer', label: 'Grand tourer' },
  { value: 'convertible', label: 'Convertible' },
  { value: 'luxury-sedan', label: 'Luxury sedan' },
  { value: 'luxury-suv', label: 'Luxury SUV' },
];

export function bodyTypeLabel(slug: string): string {
  const known = BODY_TYPES.find((t) => t.value === slug);
  if (known) return known.label;
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  // Both `?make=a&make=b` and `?make=a,b` are accepted; empty entries dropped.
  return raw.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
}

function dollarsToCents(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseMarketplaceQuery(params: SearchParamsLike = {}): MarketplaceQuery {
  const sortRaw = first(params.sort);
  const sort: MarketplaceSort = (MARKETPLACE_SORTS as readonly string[]).includes(sortRaw ?? '')
    ? (sortRaw as MarketplaceSort)
    : 'featured';
  // A price band is sugar for min/max; explicit min/max win when both present.
  const band = PRICE_BANDS.find((b) => b.value === first(params.band));
  const minDailyRateCents = dollarsToCents(first(params.min)) ?? band?.minCents;
  const maxDailyRateCents = dollarsToCents(first(params.max)) ?? band?.maxCents;
  const city = first(params.city)?.trim() || undefined;
  const state = first(params.state)?.trim().toUpperCase() || undefined;
  return {
    city,
    state,
    makes: all(params.make),
    types: all(params.type).map((t) => t.toLowerCase()),
    minDailyRateCents,
    maxDailyRateCents: maxDailyRateCents !== undefined && minDailyRateCents !== undefined && maxDailyRateCents < minDailyRateCents
      ? undefined // inverted range: ignore the max rather than returning nothing
      : maxDailyRateCents,
    sort,
    limit: clampInt(first(params.limit), MARKETPLACE_DEFAULT_LIMIT, 1, MARKETPLACE_MAX_LIMIT),
    offset: clampInt(first(params.offset), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** Inverse of parse, for building filter links. Omits defaults so URLs stay clean. */
export function toMarketplaceSearchParams(query: Partial<MarketplaceQuery> & { band?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (query.city) p.set('city', query.city);
  if (query.state) p.set('state', query.state);
  for (const make of query.makes ?? []) p.append('make', make);
  for (const type of query.types ?? []) p.append('type', type);
  if (query.band) p.set('band', query.band);
  else {
    if (query.minDailyRateCents !== undefined) p.set('min', String(query.minDailyRateCents / 100));
    if (query.maxDailyRateCents !== undefined) p.set('max', String(query.maxDailyRateCents / 100));
  }
  if (query.sort && query.sort !== 'featured') p.set('sort', query.sort);
  if (query.limit && query.limit !== MARKETPLACE_DEFAULT_LIMIT) p.set('limit', String(query.limit));
  if (query.offset) p.set('offset', String(query.offset));
  return p;
}
