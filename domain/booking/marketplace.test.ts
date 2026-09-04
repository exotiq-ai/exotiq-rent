import { describe, expect, it } from 'vitest';
import { MARKETPLACE_DEFAULT_LIMIT, MARKETPLACE_MAX_LIMIT, bodyTypeLabel, busyRangeFor, parseDateWindow, parseMarketplaceQuery, toMarketplaceSearchParams, todayIso, windowDays } from './marketplaceQuery';
import { applyMarketplaceQuery, computeFacets, excludeBusy, filterListings, listingKey, sortListings } from './marketplaceCore';
import { getMockFleetBusy, getMockMarketplaceListings } from './mockMarketplaceService';
import { rangeIsBookable } from './availability';
import { addDays } from './dates';
import { mockMarketplaceListings } from './mockMarketplaceService';
import { getMarketplaceFacets, getMarketplaceListings } from './service';

const all = mockMarketplaceListings();
const base = parseMarketplaceQuery();

describe('marketplace query parsing', () => {
  it('defaults to featured / 24 / 0 with no filters', () => {
    expect(base).toMatchObject({ sort: 'featured', limit: MARKETPLACE_DEFAULT_LIMIT, offset: 0, makes: [] });
    expect(base.city).toBeUndefined();
  });

  it('whitelists sort and clamps paging', () => {
    expect(parseMarketplaceQuery({ sort: 'DROP TABLE' }).sort).toBe('featured');
    expect(parseMarketplaceQuery({ sort: 'price_asc' }).sort).toBe('price_asc');
    expect(parseMarketplaceQuery({ limit: '9999' }).limit).toBe(MARKETPLACE_MAX_LIMIT);
    expect(parseMarketplaceQuery({ limit: '0' }).limit).toBe(1);
    expect(parseMarketplaceQuery({ offset: '-5' }).offset).toBe(0);
    expect(parseMarketplaceQuery({ offset: 'abc' }).offset).toBe(0);
  });

  it('accepts repeated and comma-joined makes, and converts dollars to cents', () => {
    expect(parseMarketplaceQuery({ make: ['McLaren', 'Ferrari'] }).makes).toEqual(['McLaren', 'Ferrari']);
    expect(parseMarketplaceQuery({ make: 'McLaren, Ferrari' }).makes).toEqual(['McLaren', 'Ferrari']);
    expect(parseMarketplaceQuery({ min: '500', max: '1999' })).toMatchObject({ minDailyRateCents: 50_000, maxDailyRateCents: 199_900 });
  });

  it('expands a price band and ignores an inverted range', () => {
    expect(parseMarketplaceQuery({ band: '500-999' })).toMatchObject({ minDailyRateCents: 50_000, maxDailyRateCents: 99_999 });
    expect(parseMarketplaceQuery({ min: '2000', max: '100' }).maxDailyRateCents).toBeUndefined();
  });

  it('round-trips through toMarketplaceSearchParams without leaking defaults', () => {
    const q = parseMarketplaceQuery({ city: 'Scottsdale', make: 'McLaren', sort: 'price_desc' });
    const params = toMarketplaceSearchParams(q).toString();
    expect(params).toContain('city=Scottsdale');
    expect(params).toContain('make=McLaren');
    expect(params).toContain('sort=price_desc');
    expect(params).not.toContain('limit=');
    expect(params).not.toContain('offset=');
  });
});

describe('marketplace core over the mock catalog', () => {
  it('lists every visible vehicle across every operator', () => {
    expect(all.length).toBeGreaterThan(3);
    expect(new Set(all.map((l) => l.team.slug)).size).toBe(3);
    expect(all.every((l) => !l.vehicle.hidden)).toBe(true);
  });

  it('filters by city (case-insensitive) and by structured make', () => {
    const scottsdale = filterListings(all, { ...base, city: 'scottsdale' });
    expect(scottsdale.length).toBeGreaterThan(0);
    expect(scottsdale.every((l) => l.team.city === 'Scottsdale')).toBe(true);
    const mclaren = filterListings(all, { ...base, makes: ['mclaren'] });
    expect(mclaren.every((l) => l.vehicle.make === 'McLaren')).toBe(true);
    // A substring that is NOT a make must not match anything — no name-substring filtering.
    expect(filterListings(all, { ...base, makes: ['Spider'] })).toHaveLength(0);
  });

  it('filters by price range inclusively', () => {
    const cheap = filterListings(all, { ...base, maxDailyRateCents: 100_000 });
    expect(cheap.every((l) => l.vehicle.dailyRateCents <= 100_000)).toBe(true);
    const pricey = filterListings(all, { ...base, minDailyRateCents: 150_000 });
    expect(pricey.every((l) => l.vehicle.dailyRateCents >= 150_000)).toBe(true);
  });

  it('sorts price ascending/descending and newest by year', () => {
    const asc = sortListings(all, 'price_asc').map((l) => l.vehicle.dailyRateCents);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortListings(all, 'price_desc').map((l) => l.vehicle.dailyRateCents);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const years = sortListings(all, 'newest').map((l) => l.vehicle.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('featured ranks verified listings first, applied uniformly', () => {
    const seeded = all.map((l, i) => ({ ...l, verified: i === all.length - 1 }));
    expect(sortListings(seeded, 'featured')[0]!.verified).toBe(true);
  });

  it('paginates with a window count that needs no second call', () => {
    const page = applyMarketplaceQuery(all, { ...base, limit: 2, offset: 2 });
    expect(page.listings).toHaveLength(2);
    expect(page.totalCount).toBe(all.length);
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(2);
  });

  it('returns a real zero-result page instead of falling back to everything', () => {
    const none = applyMarketplaceQuery(all, { ...base, city: 'Nowhere' });
    expect(none.listings).toHaveLength(0);
    expect(none.totalCount).toBe(0);
  });

  it('computes facets with real counts', () => {
    const facets = computeFacets(all);
    expect(facets.cities.reduce((n, c) => n + c.count, 0)).toBe(all.length);
    expect(facets.makes.reduce((n, m) => n + m.count, 0)).toBe(all.length);
    expect(facets.priceBands.reduce((n, b) => n + b.count, 0)).toBe(all.length);
    expect(facets.cities[0]!.label).toMatch(/, [A-Z]{2}$/);
  });
});

describe('availability window (MP-10)', () => {
  const today = '2026-09-04';
  it('accepts only a complete, well-formed, forward, ≤180-day window', () => {
    expect(parseDateWindow('2026-09-10', '2026-09-12', today)).toEqual({ start: '2026-09-10', end: '2026-09-12' });
    expect(parseDateWindow('2026-09-10', undefined, today)).toBeUndefined();
    expect(parseDateWindow('2026-09-12', '2026-09-10', today)).toBeUndefined();
    expect(parseDateWindow('2026-09-10', '2026-09-10', today)).toBeUndefined(); // a rental is at least one day
    expect(parseDateWindow('2026-02-30', '2026-03-02', today)).toBeUndefined();
    expect(parseDateWindow('2026-09-10', '2027-04-01', today)).toBeUndefined();
    expect(parseDateWindow('2026-08-01', '2026-08-03', today)).toBeUndefined();
    expect(parseDateWindow('2026-09-02', '2026-09-05', today)).toBeUndefined(); // pickup two days ago
    expect(parseDateWindow('2026-09-03', '2026-09-05', today)).toEqual({ start: '2026-09-03', end: '2026-09-05' }); // one day of timezone grace
    expect(parseDateWindow('2027-06-01', '2027-06-03', today)).toBeUndefined(); // beyond the booking horizon
  });

  it('round-trips ?start&end through the query and drops a half window', () => {
    const [s, e] = [addDays(todayIso(), 10), addDays(todayIso(), 12)];
    const q = parseMarketplaceQuery({ start: s, end: e });
    expect(q.start).toBe(s);
    expect(toMarketplaceSearchParams(q).toString()).toBe(`start=${s}&end=${e}`);
    expect(parseMarketplaceQuery({ start: s }).start).toBeUndefined();
  });

  it('derives rental days and asks the busy read about the whole inclusive window', () => {
    expect(windowDays({ start: '2099-01-10', end: '2099-01-12' })).toBe(2);
    expect(windowDays({ start: '2099-01-10', end: '2099-01-10' })).toBe(1);
    // Inclusive of the drop-off day: the calendar counts it, so the grid asks about it.
    expect(busyRangeFor({ start: '2099-01-10', end: '2099-01-12' })).toEqual({ start: '2099-01-10', end: '2099-01-12' });
  });

  it('excludes cars whose minimum stay is longer than the window, and busy cars', () => {
    const q = parseMarketplaceQuery({ start: addDays(todayIso(), 10), end: addDays(todayIso(), 11) });
    const oneDay = filterListings(all, q);
    expect(oneDay.every((l) => l.vehicle.minRentalDays <= 1)).toBe(true);
    expect(oneDay.length).toBeLessThan(all.length);
    const [first] = all;
    const busy = new Set([listingKey(first.team.slug, first.vehicle.slug)]);
    expect(excludeBusy(all, busy)).toHaveLength(all.length - 1);
    expect(excludeBusy(all, new Set())).toBe(all);
  });

  it('mock busy set comes from unavailableRanges and marks the page as checked', async () => {
    const withRange = all.find((l) => (l.vehicle.unavailableRanges ?? []).length > 0)!;
    const r = withRange.vehicle.unavailableRanges![0];
    const { busy, checked } = await getMockFleetBusy({ start: r.start, end: r.end });
    expect(checked).toBe(true);
    expect(busy.has(listingKey(withRange.team.slug, withRange.vehicle.slug))).toBe(true);
    const page = await getMockMarketplaceListings({ ...parseMarketplaceQuery(), start: r.start, end: r.end });
    expect(page.availability).toEqual({ start: r.start, end: r.end, checked: true });
    expect(page.listings.some((l) => l.vehicle.slug === withRange.vehicle.slug)).toBe(false);
  });
});

describe('rangeIsBookable — the one rule the calendar and the seed share', () => {
  const vehicle = { minRentalDays: 2, unavailableRanges: [{ start: '2099-01-15', end: '2099-01-16' }] };
  it('accepts a forward range of at least the minimum stay with no blocked day, drop-off day included', () => {
    expect(rangeIsBookable(vehicle, '2099-01-10', '2099-01-12', '2099-01-01')).toBe(true);
    expect(rangeIsBookable(vehicle, '2099-01-10', '2099-01-11', '2099-01-01')).toBe(false); // shorter than minimum
    expect(rangeIsBookable(vehicle, '2099-01-13', '2099-01-15', '2099-01-01')).toBe(false); // drop-off on a blocked day
    expect(rangeIsBookable(vehicle, '2099-01-17', '2099-01-19', '2099-01-01')).toBe(true); // the day after the block
    expect(rangeIsBookable(vehicle, '2098-12-30', '2099-01-02', '2099-01-01')).toBe(false); // starts in the past
    expect(rangeIsBookable(vehicle, '2099-01-10', '2099-01-10', '2099-01-01')).toBe(false); // zero days
  });
});

describe('vehicle type (MP-9)', () => {
  it('parses ?type (repeated or comma-joined, case-insensitive) and round-trips it', () => {
    const q = parseMarketplaceQuery({ type: ['Supercar', 'luxury-suv,sports-car'] });
    expect(q.types).toEqual(['supercar', 'luxury-suv', 'sports-car']);
    expect(toMarketplaceSearchParams(q).getAll('type')).toEqual(['supercar', 'luxury-suv', 'sports-car']);
    expect(parseMarketplaceQuery({ type: ['supercar', 'SUPERCAR'] }).types).toEqual(['supercar']);
  });

  it('labels unknown vocabulary readably', () => {
    expect(bodyTypeLabel('electric-suv')).toBe('Electric SUV');
    expect(bodyTypeLabel('luxury-suv')).toBe('Luxury SUV');
  });

  it('filters by type and never matches an unclassified car', () => {
    const typed = all.filter((l) => l.vehicle.bodyType);
    expect(typed.length).toBeGreaterThan(0);
    const supercars = filterListings(all, parseMarketplaceQuery({ type: 'supercar' }));
    expect(supercars.length).toBeGreaterThan(0);
    expect(supercars.every((l) => l.vehicle.bodyType === 'supercar')).toBe(true);
    expect(filterListings(all, parseMarketplaceQuery({ type: 'hypercar' }))).toEqual([]);
  });

  it('facets only the types cars carry, in vocabulary order, with labels', () => {
    const f = computeFacets(all);
    expect(f.types.every((t) => t.count > 0)).toBe(true);
    expect(f.types.map((t) => t.value)).not.toContain('hypercar');
    const order = f.types.map((t) => t.value);
    expect(order.indexOf('supercar')).toBeLessThan(order.indexOf('luxury-suv'));
    expect(f.types.find((t) => t.value === 'luxury-suv')?.label).toBe('Luxury SUV');
    expect(computeFacets(all.filter((l) => !l.vehicle.bodyType)).types).toEqual([]);
  });
});

describe('facet keys', () => {
  it('keeps same-named cities in different states apart', () => {
    const [a, ...rest] = all;
    const twin = { ...a, team: { ...a.team, slug: 'twin', state: 'XX' } };
    const same = computeFacets([a, twin, ...rest]).cities.filter((c) => c.value.toLowerCase() === a.team.city.toLowerCase());
    expect(same.map((c) => c.label).sort()).toEqual([`${a.team.city}, ${a.team.state}`, `${a.team.city}, XX`].sort());
  });

  it('merges make spellings the way the filter compares them', () => {
    const [a] = all;
    const shouty = { ...a, vehicle: { ...a.vehicle, slug: 'shouty', make: a.vehicle.make.toUpperCase() } };
    expect(computeFacets([a, shouty]).makes).toEqual([{ value: a.vehicle.make, label: a.vehicle.make, count: 2 }]);
  });
});

describe('facade in mock mode', () => {
  it('serves listings and facets through service.ts', async () => {
    const page = await getMarketplaceListings(base);
    expect(page.totalCount).toBe(all.length);
    const facets = await getMarketplaceFacets();
    expect(facets.cities.length).toBe(3);
  });
});
