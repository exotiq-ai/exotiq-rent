'use client';

import { useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { MARKETPLACE_SORTS, PRICE_BANDS, todayIso } from '@/domain/booking/marketplaceQuery';

const SORT_LABELS: Record<MarketplaceQuery['sort'], string> = {
  featured: 'Featured',
  price_asc: 'Lowest price',
  price_desc: 'Highest price',
  newest: 'Newest',
};

/**
 * Horizontal filter bar for a single storefront (MP-8): the cyan mockup's
 * anatomy — sort pills, make chips, price-band chips — in the gold language.
 * Same contract as the browse rail: a plain GET form whose URL is the only
 * state (shareable, works with JavaScript off), navigating on every change.
 * Inputs are visually hidden and the chip is their label, so keyboard and
 * screen-reader behaviour is the native control's. Mount it with a key tied
 * to the query so uncontrolled inputs never keep stale state across
 * search-param navigations.
 */
export function FilterBar({ facets, query, action, idPrefix = 'sf' }: { facets: MarketplaceFacets; query: MarketplaceQuery; action: string; idPrefix?: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  const currentBand = PRICE_BANDS.find(
    (b) => b.minCents === (query.minDailyRateCents ?? 0) && b.maxCents === query.maxDailyRateCents,
  )?.value ?? '';
  const hasWindow = Boolean(query.start && query.end);
  const active = query.makes.length + query.types.length + (currentBand ? 1 : 0) + (hasWindow ? 1 : 0);
  const today = todayIso();
  // Price bands are contiguous and inclusive, so their counts sum to the fleet.
  const fleetSize = facets.priceBands.reduce((n, b) => n + b.count, 0);
  // A lone type chip only earns its place when it can narrow the result —
  // i.e. some cars are still unclassified. One type across the whole fleet
  // would toggle between N of N and N of N.
  const typesNarrow = facets.types.length > 1 || (facets.types.length === 1 && facets.types[0].count < fleetSize);

  const navigate = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    // Dates apply as a pair: with only one picked, wait for the other instead
    // of navigating to a URL the parser would drop anyway.
    const start = String(data.get('start') ?? '');
    const end = String(data.get('end') ?? '');
    if ((start === '') !== (end === '')) return;
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value !== 'string' || value === '') return;
      if (key === 'sort' && value === 'featured') return;
      params.append(key, value);
    });
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    navigate();
  };

  const row = 'flex flex-wrap items-center gap-2';
  const label = 'mr-1 text-[10px] uppercase tracking-[0.22em] text-[#848A9A]';
  const chip = 'relative cursor-pointer';
  const face =
    'inline-flex items-center gap-1.5 rounded-full border border-[#3A3F4D] bg-[#10131A] px-3 py-1.5 text-[12px] text-[#9BA1B0] transition ' +
    'peer-checked:border-[#C8A664]/70 peer-checked:bg-[#C8A664]/10 peer-checked:font-semibold peer-checked:text-[#F0F2F5] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C8A664]/60 hover:border-[#C8A664]/40 hover:text-[#F0F2F5]';
  const count = 'text-[10px] tabular-nums text-[#848A9A]';
  const date = 'rounded-full border border-[#2A2E3A] bg-[#10131A] px-3 py-1.5 text-[12px] text-[#F0F2F5] outline-none focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark]';

  return (
    <form ref={form} method="get" action={action} onSubmit={onSubmit} onChange={navigate} className="space-y-2.5" aria-label="Filter the fleet">
      <div className={row} role="group" aria-labelledby={`${idPrefix}-dates-label`}>
        <span id={`${idPrefix}-dates-label`} className={label}>Dates</span>
        <label className="sr-only" htmlFor={`${idPrefix}-start`}>Pickup date</label>
        <input id={`${idPrefix}-start`} type="date" name="start" min={today} defaultValue={query.start ?? ''} className={date} />
        <span className="text-[11px] text-[#848A9A]">to</span>
        <label className="sr-only" htmlFor={`${idPrefix}-end`}>Drop-off date</label>
        <input id={`${idPrefix}-end`} type="date" name="end" min={query.start ?? today} defaultValue={query.end ?? ''} className={date} />
      </div>
      <div className={row} role="group" aria-labelledby={`${idPrefix}-sort-label`}>
        <span id={`${idPrefix}-sort-label`} className={label}>Sort</span>
        {MARKETPLACE_SORTS.map((s) => (
          <label key={s} className={chip}>
            <input type="radio" name="sort" value={s} defaultChecked={query.sort === s} className="peer sr-only" id={`${idPrefix}-sort-${s}`} />
            <span className={face}>{SORT_LABELS[s]}</span>
          </label>
        ))}
      </div>

      {typesNarrow && (
        <div className={row} role="group" aria-labelledby={`${idPrefix}-type-label`}>
          <span id={`${idPrefix}-type-label`} className={label}>Type</span>
          {facets.types.map((t) => (
            <label key={t.value} className={chip}>
              <input type="checkbox" name="type" value={t.value} defaultChecked={query.types.includes(t.value)} className="peer sr-only" />
              <span className={face}>{t.label}<span className={count}> {t.count}</span></span>
            </label>
          ))}
        </div>
      )}

      {facets.makes.length > 1 && (
        <div className={row} role="group" aria-labelledby={`${idPrefix}-make-label`}>
          <span id={`${idPrefix}-make-label`} className={label}>Make</span>
          {facets.makes.map((m) => (
            <label key={m.value} className={chip}>
              <input type="checkbox" name="make" value={m.value} defaultChecked={query.makes.some((x) => x.toLowerCase() === m.value.toLowerCase())} className="peer sr-only" />
              <span className={face}>{m.label}<span className={count}> {m.count}</span></span>
            </label>
          ))}
        </div>
      )}

      <div className={row} role="group" aria-labelledby={`${idPrefix}-band-label`}>
        <span id={`${idPrefix}-band-label`} className={label}>Daily rate</span>
        <label className={chip}>
          <input type="radio" name="band" value="" defaultChecked={currentBand === ''} className="peer sr-only" />
          <span className={face}>Any</span>
        </label>
        {facets.priceBands.filter((b) => b.count > 0).map((b) => (
          <label key={b.value} className={chip}>
            <input type="radio" name="band" value={b.value} defaultChecked={currentBand === b.value} className="peer sr-only" />
            <span className={face}>{b.label}<span className={count}> {b.count}</span></span>
          </label>
        ))}
        {active > 0 && (
          <Link href={action} className="ml-1 text-[12px] text-[#848A9A] underline decoration-[#2A2E3A] underline-offset-4 transition hover:text-[#F0F2F5]">
            Clear {active === 1 ? 'filter' : 'filters'}
          </Link>
        )}
        <noscript>
          <button type="submit" className="rounded-full border border-[#C8A664]/40 px-3 py-1.5 text-[12px] font-semibold text-[#C8A664]">Apply</button>
        </noscript>
      </div>
    </form>
  );
}
