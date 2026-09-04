import { describe, expect, it } from 'vitest';
import { MARKETPLACE_DEFAULT_LIMIT, MARKETPLACE_MAX_LIMIT, parseMarketplaceQuery, toMarketplaceSearchParams } from './marketplaceQuery';
import { applyMarketplaceQuery, computeFacets, filterListings, sortListings } from './marketplaceCore';
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

describe('vehicle type (MP-9)', () => {
  it('parses ?type (repeated or comma-joined, case-insensitive) and round-trips it', () => {
    const q = parseMarketplaceQuery({ type: ['Supercar', 'luxury-suv,sports-car'] });
    expect(q.types).toEqual(['supercar', 'luxury-suv', 'sports-car']);
    expect(toMarketplaceSearchParams(q).getAll('type')).toEqual(['supercar', 'luxury-suv', 'sports-car']);
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
