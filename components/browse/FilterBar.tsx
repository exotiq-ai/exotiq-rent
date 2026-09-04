'use client';

import { useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { MARKETPLACE_SORTS, PRICE_BANDS } from '@/domain/booking/marketplaceQuery';

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
  const active = query.makes.length + query.types.length + (currentBand ? 1 : 0);

  const navigate = () => {
    if (!form.current) return;
    const params = new URLSearchParams();
    new FormData(form.current).forEach((value, key) => {
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
    'inline-flex items-center gap-1.5 rounded-full border border-[#2A2E3A] bg-[#10131A] px-3 py-1.5 text-[12px] text-[#9BA1B0] transition ' +
    'peer-checked:border-[#C8A664]/70 peer-checked:bg-[#C8A664]/10 peer-checked:text-[#F0F2F5] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C8A664]/60 hover:border-[#C8A664]/40 hover:text-[#F0F2F5]';
  const count = 'text-[10px] tabular-nums text-[#848A9A]';

  return (
    <form ref={form} method="get" action={action} onSubmit={onSubmit} onChange={navigate} className="space-y-2.5" aria-label="Filter the fleet">
      <div className={row}>
        <span className={label}>Sort</span>
        {MARKETPLACE_SORTS.map((s) => (
          <label key={s} className={chip}>
            <input type="radio" name="sort" value={s} defaultChecked={query.sort === s} className="peer sr-only" id={`${idPrefix}-sort-${s}`} />
            <span className={face}>{SORT_LABELS[s]}</span>
          </label>
        ))}
      </div>

      {facets.makes.length > 1 && (
        <div className={row}>
          <span className={label}>Make</span>
          {facets.makes.map((m) => (
            <label key={m.value} className={chip}>
              <input type="checkbox" name="make" value={m.value} defaultChecked={query.makes.some((x) => x.toLowerCase() === m.value.toLowerCase())} className="peer sr-only" />
              <span className={face}>{m.label}<span className={count}>{m.count}</span></span>
            </label>
          ))}
        </div>
      )}

      {facets.types.length > 0 && (
        <div className={row}>
          <span className={label}>Type</span>
          {facets.types.map((t) => (
            <label key={t.value} className={chip}>
              <input type="checkbox" name="type" value={t.value} defaultChecked={query.types.includes(t.value)} className="peer sr-only" />
              <span className={face}>{t.label}<span className={count}>{t.count}</span></span>
            </label>
          ))}
        </div>
      )}

      <div className={row}>
        <span className={label}>Daily rate</span>
        <label className={chip}>
          <input type="radio" name="band" value="" defaultChecked={currentBand === ''} className="peer sr-only" />
          <span className={face}>Any</span>
        </label>
        {facets.priceBands.filter((b) => b.count > 0).map((b) => (
          <label key={b.value} className={chip}>
            <input type="radio" name="band" value={b.value} defaultChecked={currentBand === b.value} className="peer sr-only" />
            <span className={face}>{b.label}<span className={count}>{b.count}</span></span>
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
