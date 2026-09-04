import { addDays } from './dates';
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
 * what renters see, in sentence case like every other renter-facing label
 * (the Command Center shows the same words in Title Case; do not align).
 * An unknown slug in a URL simply matches nothing.
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
  // Vocabulary drift guard: a slug the DB accepts before the app knows it
  // still gets a readable label ('electric-suv' → 'Electric SUV').
  return slug
    .split('-')
    .map((w, i) => (['suv', 'gt', 'ev'].includes(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Longest availability window the busy read accepts (matches public_fleet_busy). */
export const MAX_WINDOW_DAYS = 180;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Whole days between two ISO dates (end − start). */
export function daysBetween(startIso: string, endIso: string): number {
  return Math.round((Date.UTC(+endIso.slice(0, 4), +endIso.slice(5, 7) - 1, +endIso.slice(8, 10)) - Date.UTC(+startIso.slice(0, 4), +startIso.slice(5, 7) - 1, +startIso.slice(8, 10))) / 86_400_000);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Availability window from ?start&end (MP-10). Valid = both present, real
 * dates, a real rental (drop-off after pickup), at most MAX_WINDOW_DAYS long,
 * starting no earlier than yesterday (one day of grace because the server
 * judges "today" in UTC while renters pick dates in Phoenix or Tampa) and no
 * further out than the booking horizon. Anything else is dropped — a half or
 * nonsense window must never turn into "every car is available".
 */
export function parseDateWindow(start: string | undefined, end: string | undefined, today = todayIso()): { start: string; end: string } | undefined {
  if (!start || !end || !isValidIsoDate(start) || !isValidIsoDate(end)) return undefined;
  if (end <= start) return undefined;
  if (daysBetween(start, end) > MAX_WINDOW_DAYS) return undefined;
  if (start < addDays(today, -1)) return undefined;
  if (daysBetween(today, start) > MAX_WINDOW_DAYS) return undefined;
  return { start, end };
}

/** Rental length the window implies: pickup day to drop-off day. */
export function windowDays(query: { start?: string; end?: string }): number | undefined {
  if (!query.start || !query.end) return undefined;
  return Math.max(1, daysBetween(query.start, query.end));
}

/**
 * The range the busy read is asked about: the whole window, drop-off day
 * included. Conservative on purpose — the booking calendar treats every day
 * of a selection as one the car must be free on, so the grid asks the same
 * question and can never advertise a car the calendar would then refuse.
 * (Asking for [pickup, drop-off − 1] listed cars whose next booking picks up
 * on the renter's drop-off day; review of #99.)
 */
export function busyRangeFor(window: { start: string; end: string }): { start: string; end: string } {
  return { start: window.start, end: window.end };
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
  const window = parseDateWindow(first(params.start)?.trim(), first(params.end)?.trim());
  return {
    city,
    state,
    start: window?.start,
    end: window?.end,
    makes: all(params.make),
    types: Array.from(new Set(all(params.type).map((t) => t.toLowerCase()))),
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
  if (query.start && query.end) {
    p.set('start', query.start);
    p.set('end', query.end);
  }
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
