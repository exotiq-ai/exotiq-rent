'use client';

import { useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { MARKETPLACE_SORTS, PRICE_BANDS, todayIso } from '@/domain/booking/marketplaceQuery';

const SORT_LABELS: Record<MarketplaceQuery['sort'], string> = {
  featured: 'Featured',
  price_desc: 'Price: high to low',
  price_asc: 'Price: low to high',
  newest: 'Newest models',
};

/**
 * Filters & sort (MP-3). The URL is the only state: every change navigates to
 * the URL the form describes, so any filtered view is a shareable link and
 * the server re-renders from searchParams. It is a plain GET form underneath
 * — with JavaScript off, "Show results" still works.
 */
export function FilterForm({ facets, query, idPrefix = 'f' }: { facets: MarketplaceFacets; query: MarketplaceQuery; idPrefix?: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  const currentBand = PRICE_BANDS.find(
    (b) => b.minCents === (query.minDailyRateCents ?? 0) && b.maxCents === query.maxDailyRateCents,
  )?.value ?? '';

  const navigate = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    // Dates apply as a pair — see FilterBar.
    const start = String(data.get('start') ?? '');
    const end = String(data.get('end') ?? '');
    if ((start === '') !== (end === '')) return;
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value !== 'string' || value === '') return;
      if (key === 'sort' && value === 'featured') return;
      params.append(key, value);
    });
    // A filter change always restarts paging — page 3 of a different result set is meaningless.
    const qs = params.toString();
    router.push(qs ? `/browse?${qs}` : '/browse');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    navigate();
  };

  const section = 'block text-[10px] uppercase tracking-[0.22em] text-[#848A9A]';
  const option = 'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5]';
  const count = 'text-[11px] tabular-nums text-[#848A9A]';

  return (
    <form ref={form} method="get" action="/browse" onSubmit={onSubmit} onChange={navigate} className="space-y-7">
      <fieldset>
        <legend className={section}>Dates</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[10px] text-[#848A9A]">Pickup</span>
            <input type="date" name="start" min={todayIso()} defaultValue={query.start ?? ''} className="mt-1 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-2.5 py-2 text-[12px] text-[#F0F2F5] outline-none focus:border-[#C8A664]/60 [color-scheme:dark]" />
          </label>
          <label className="block">
            <span className="block text-[10px] text-[#848A9A]">Drop-off</span>
            <input type="date" name="end" min={query.start ?? todayIso()} defaultValue={query.end ?? ''} className="mt-1 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-2.5 py-2 text-[12px] text-[#F0F2F5] outline-none focus:border-[#C8A664]/60 [color-scheme:dark]" />
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-sort`} className={section}>Sort</label>
        <select
          id={`${idPrefix}-sort`}
          name="sort"
          defaultValue={query.sort}
          className="mt-2 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-[13px] text-[#F0F2F5] outline-none focus:border-[#C8A664]/60 [color-scheme:dark]"
        >
          {MARKETPLACE_SORTS.map((s) => (
            <option key={s} value={s}>{SORT_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={section}>City</legend>
        <div className="mt-2 space-y-0.5">
          <label className={option}>
            <span className="flex items-center gap-2.5"><input type="radio" name="city" value="" defaultChecked={!query.city} className="accent-[#C8A664]" />All cities</span>
          </label>
          {facets.cities.map((c) => (
            <label key={c.value} className={option}>
              <span className="flex items-center gap-2.5"><input type="radio" name="city" value={c.value} defaultChecked={query.city?.toLowerCase() === c.value.toLowerCase()} className="accent-[#C8A664]" />{c.label}</span>
              <span className={count}>{c.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {facets.types.length > 0 && (
        <fieldset>
          <legend className={section}>Type</legend>
          <div className="mt-2 space-y-0.5">
            {facets.types.map((t) => (
              <label key={t.value} className={option}>
                <span className="flex items-center gap-2.5"><input type="checkbox" name="type" value={t.value} defaultChecked={query.types.includes(t.value)} className="accent-[#C8A664]" />{t.label}</span>
                <span className={count}>{t.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className={section}>Make</legend>
        <div className="mt-2 space-y-0.5">
          {facets.makes.map((m) => (
            <label key={m.value} className={option}>
              <span className="flex items-center gap-2.5"><input type="checkbox" name="make" value={m.value} defaultChecked={query.makes.some((x) => x.toLowerCase() === m.value.toLowerCase())} className="accent-[#C8A664]" />{m.label}</span>
              <span className={count}>{m.count}</span>
            </label>
          ))}
        </div>
      </fieldset>


      <fieldset>
        <legend className={section}>Daily rate</legend>
        <div className="mt-2 space-y-0.5">
          <label className={option}>
            <span className="flex items-center gap-2.5"><input type="radio" name="band" value="" defaultChecked={currentBand === ''} className="accent-[#C8A664]" />Any</span>
          </label>
          {facets.priceBands.map((b) => (
            <label key={b.value} className={option}>
              <span className="flex items-center gap-2.5"><input type="radio" name="band" value={b.value} defaultChecked={currentBand === b.value} className="accent-[#C8A664]" />{b.label}</span>
              <span className={count}>{b.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 border-t border-[#2A2E3A] pt-5">
        <Link href="/browse" className="text-[12px] text-[#848A9A] underline decoration-[#2A2E3A] underline-offset-4 transition hover:text-[#9BA1B0]">Clear all</Link>
        <button type="submit" className="rounded-lg border border-[#C8A664]/40 px-4 py-2 text-[12px] font-semibold text-[#C8A664] transition hover:bg-[#C8A664]/10">Show results</button>
      </div>
    </form>
  );
}
