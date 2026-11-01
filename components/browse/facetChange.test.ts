// MP-36 AC5(b): the one facet a bar submission changes, by name only — dates first, then sort, make, band — and
// null when nothing (or only the type) differs. The submission is the URLSearchParams navigate() builds from the
// form (empty values and sort=featured already dropped); the query is the page's parsed URL. The clock is frozen
// because parseMarketplaceQuery drops a date window that starts before yesterday.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PRICE_BANDS, parseMarketplaceQuery, type SearchParamsLike } from '@/domain/booking/marketplaceQuery';
import { changedFacet, createNavigationGate } from './facetChange';

const NOW_ISO = '2026-11-01T18:00:00.000Z';
const q = (params: SearchParamsLike = {}) => parseMarketplaceQuery(params);
const form = (...entries: [string, string][]) => new URLSearchParams(entries);
const NAMES: (string | null)[] = ['dates', 'sort', 'make', 'band', null];
const DATES: [string, string][] = [['start', '2026-11-10'], ['end', '2026-11-12']];

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW_ISO)); });
afterAll(() => { vi.useRealTimers(); });

describe('MP-36 changedFacet', () => {
  it('changedFacet names the one facet that differs, dates first, and never a value', () => {
    expect(q({ start: '2026-11-10', end: '2026-11-12' }).start, 'the fixture window parses').toBe('2026-11-10');
    expect(changedFacet(q(), form(...DATES))).toBe('dates');
    expect(changedFacet(q({ start: '2026-11-10', end: '2026-11-12' }), form())).toBe('dates');
    expect(changedFacet(q({ start: '2026-11-10', end: '2026-11-12' }), form(['start', '2026-11-10'], ['end', '2026-11-13']))).toBe('dates');
    expect(changedFacet(q(), form(['sort', 'price_asc']))).toBe('sort');
    expect(changedFacet(q({ sort: 'newest' }), form())).toBe('sort');
    expect(changedFacet(q(), form(['make', 'Lamborghini']))).toBe('make');
    expect(changedFacet(q({ make: ['Lamborghini', 'Ferrari'] }), form(['make', 'Ferrari']))).toBe('make');
    expect(changedFacet(q({ make: 'Lamborghini' }), form())).toBe('make');
    expect(changedFacet(q(), form(['band', 'under-500']))).toBe('band');
    expect(changedFacet(q({ band: 'under-500' }), form())).toBe('band');
    expect(changedFacet(q({ band: 'under-500' }), form(['band', '500-999']))).toBe('band');
    // Precedence when several differ.
    const all: [string, string][] = [...DATES, ['sort', 'newest'], ['make', 'Ferrari'], ['band', '2000-plus']];
    expect(changedFacet(q(), form(...all))).toBe('dates');
    expect(changedFacet(q(), form(...all.slice(2)))).toBe('sort');
    expect(changedFacet(q(), form(...all.slice(3)))).toBe('make');
    expect(changedFacet(q(), form(...all.slice(4)))).toBe('band');
    // Never a value: over real make names and every band slug the result is one of the four names or null.
    const makes = ['Lamborghini', 'Rolls-Royce', 'Aston Martin', 'Mercedes-Benz', 'Koenigsegg'];
    const bands = PRICE_BANDS.map((b) => b.value);
    for (const make of makes) for (const band of bands) {
      for (const query of [q(), q({ make }), q({ band }), q({ make, band })]) {
        for (const submitted of [form(), form(['make', make]), form(['band', band]), form(['make', make], ['band', band])]) {
          const got = changedFacet(query, submitted);
          expect(NAMES, `${make} / ${band}`).toContain(got);
          expect(JSON.stringify(got)).not.toMatch(/Lamborghini|Rolls|Aston|Mercedes|Koenigsegg|under-500|500-999|1000-1999|2000-plus/);
        }
      }
    }
  });

  it('changedFacet is null when the submission equals the current query or only the type changed', () => {
    expect(changedFacet(q(), form())).toBeNull();
    expect(changedFacet(q(), form(['sort', 'featured']))).toBeNull();
    const full = q({ make: ['Lamborghini', 'Ferrari'], band: '500-999', start: '2026-11-10', end: '2026-11-12', sort: 'newest' });
    expect(changedFacet(full, form(...DATES, ['sort', 'newest'], ['make', 'Lamborghini'], ['make', 'Ferrari'], ['band', '500-999']))).toBeNull();
    // Make comparison is case-insensitive and order-free, like the chip's defaultChecked.
    expect(changedFacet(full, form(...DATES, ['sort', 'newest'], ['make', 'ferrari'], ['make', 'LAMBORGHINI'], ['band', '500-999']))).toBeNull();
    // A type-only change emits nothing (A2).
    expect(changedFacet(q(), form(['type', 'supercar']))).toBeNull();
    expect(changedFacet(q({ type: 'supercar' }), form())).toBeNull();
    expect(changedFacet(q({ make: 'Lamborghini' }), form(['make', 'Lamborghini'], ['type', 'supercar']))).toBeNull();
    // Explicit min/max that match no band read as "no band", exactly as the bar's Any radio does.
    expect(changedFacet(q({ min: '600' }), form())).toBeNull();
  });

  it('changedFacet is null when the hidden inputs carry a deep-linked facet back unchanged', () => {
    // Fix round F1: the hidden-state bar re-submits the URL's own make / type / band / min / max as hidden inputs.
    expect(changedFacet(q({ make: 'Lamborghini' }), form(['make', 'Lamborghini']))).toBeNull();
    expect(changedFacet(q({ make: ['Lamborghini', 'Ferrari'] }), form(['make', 'Lamborghini'], ['make', 'Ferrari']))).toBeNull();
    expect(changedFacet(q({ type: 'supercar' }), form(['type', 'supercar']))).toBeNull();
    expect(changedFacet(q({ band: 'under-500' }), form(['band', 'under-500']))).toBeNull();
    expect(changedFacet(q({ min: '600' }), form(['min', '600']))).toBeNull();
    expect(changedFacet(q({ max: '400' }), form(['max', '400']))).toBeNull();
    expect(changedFacet(q({ min: '600', max: '900' }), form(['min', '600'], ['max', '900']))).toBeNull();
    // The carried facet never masks a real change.
    expect(changedFacet(q({ make: 'Lamborghini' }), form(['sort', 'price_asc'], ['make', 'Lamborghini']))).toBe('sort');
    expect(changedFacet(q({ min: '600' }), form(...DATES, ['min', '600']))).toBe('dates');
    // Contrast: a form that drops the make (the bar before F1) reads as a make change — the false event F1 removes.
    expect(changedFacet(q({ make: 'Lamborghini' }), form())).toBe('make');
  });

  it('navigationGate allows one push per form state and none when nothing changed', () => {
    // Fix round F3: a date commit followed by Enter runs navigate() twice before the keyed remount, and an unchanged
    // submit would push the page onto itself. The gate compares the next search with the last push and with the
    // document's own search (order and the leading ? do not matter).
    const allow = createNavigationGate();
    expect(allow('', '')).toBe(false);
    expect(allow('', '?')).toBe(false);
    expect(allow('make=Lamborghini', '?make=Lamborghini')).toBe(false);
    expect(allow('sort=newest&make=Lamborghini', '?make=Lamborghini&sort=newest')).toBe(false);
    expect(allow('sort=price_asc', '?make=Lamborghini')).toBe(true);
    expect(allow('sort=price_asc', '?make=Lamborghini')).toBe(false);
    expect(allow('sort=newest', '?make=Lamborghini')).toBe(true);
    expect(allow('sort=price_asc', '?make=Lamborghini')).toBe(true);
    expect(allow('', '?make=Lamborghini')).toBe(true);
    // One gesture, one push, one emit — the shape navigate() runs.
    const gate = createNavigationGate();
    const query = q({ make: 'Lamborghini' });
    const pushes: string[] = [];
    const emits: string[] = [];
    const run = (params: URLSearchParams) => {
      const qs = params.toString();
      if (!gate(qs, '?make=Lamborghini')) return;
      const facet = changedFacet(query, params);
      if (facet) emits.push(facet);
      pushes.push(qs);
    };
    const submitted = form(...DATES, ['make', 'Lamborghini']);
    run(submitted);
    run(submitted);
    expect(pushes).toEqual(['start=2026-11-10&end=2026-11-12&make=Lamborghini']);
    expect(emits).toEqual(['dates']);
    run(form(['make', 'Lamborghini']));
    expect(pushes).toHaveLength(1);
    expect(emits).toHaveLength(1);
  });
});
