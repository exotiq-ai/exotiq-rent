'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { MARKETPLACE_SORTS, PRICE_BANDS, daysBetween } from '@/domain/booking/marketplaceQuery';
import { addDays } from '@/domain/booking/dates';
import { localTodayIso } from '@/domain/booking/availability';
import { datePillClassName, selectClassName } from './tokens';

function datesHint(start: string, end: string): string {
  if (start && end) return 'Cars shown are free for these dates.';
  if (start) return 'Add a drop-off date to filter by availability.';
  if (end) return 'Add a pickup date to filter by availability.';
  return 'Pick pickup and drop-off days to see what is free.';
}

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
  // MP-12: a chip flipped and then nothing happened for the RPC round-trip.
  // The push runs in a transition so the form knows it is pending: a gold
  // hairline at the top and dimmed controls until the new grid commits.
  const [isPending, startTransition] = useTransition();
  const today = localTodayIso();
  const [hint, setHint] = useState(() => datesHint(query.start ?? '', query.end ?? ''));

  // Same date reconciliation as FilterBar: live drop-off minimum, and an
  // inverted pair carries the rental length forward instead of wiping dates.
  const reconcileDates = (): { start: string; end: string } => {
    const f = form.current!;
    const startEl = f.elements.namedItem('start') as HTMLInputElement;
    const endEl = f.elements.namedItem('end') as HTMLInputElement;
    const start = startEl.value;
    let end = endEl.value;
    endEl.min = start ? addDays(start, 1) : addDays(today, 1);
    if (start && end && end <= start) {
      const prevDays = query.start && query.end ? Math.max(1, daysBetween(query.start, query.end)) : 1;
      end = addDays(start, prevDays);
      endEl.value = end;
    }
    setHint(datesHint(start, end));
    return { start, end };
  };

  const currentBand = PRICE_BANDS.find(
    (b) => b.minCents === (query.minDailyRateCents ?? 0) && b.maxCents === query.maxDailyRateCents,
  )?.value ?? '';

  const navigate = () => {
    if (!form.current) return;
    // Dates apply as a pair — see FilterBar.
    const { start, end } = reconcileDates();
    if ((start === '') !== (end === '')) return;
    const data = new FormData(form.current);
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value !== 'string' || value === '') return;
      if (key === 'sort' && value === 'featured') return;
      params.append(key, value);
    });
    // A filter change always restarts paging — page 3 of a different result set is meaningless.
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/browse?${qs}` : '/browse'));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const { start, end } = reconcileDates();
    if ((start === '') !== (end === '')) {
      const missing = form.current!.elements.namedItem(start ? 'end' : 'start') as HTMLInputElement;
      missing.setCustomValidity(start ? 'Add a drop-off date' : 'Add a pickup date');
      missing.reportValidity();
      missing.focus();
      missing.setCustomValidity('');
      return;
    }
    navigate();
  };

  const section = 'block text-[10px] uppercase tracking-[0.16em] text-[#848A9A]';
  // MP-11: 44px rows in the phone sheet (every mis-tap navigates), the rail
  // keeps its density; a checked row lights up like the mockup's.
  const option = 'group-data-[pending]:opacity-60 group-data-[pending]:cursor-progress flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-[13px] text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5] has-[:checked]:text-[#F0F2F5] lg:min-h-0 lg:py-1.5';
  const count = 'text-[11px] tabular-nums text-[#848A9A]';

  return (
    <form ref={form} method="get" action="/browse" onSubmit={onSubmit} onChange={navigate} className="group relative space-y-7" aria-busy={isPending} data-pending={isPending ? '' : undefined}>
      {/* Always mounted, opacity-toggled, so the rail never jumps. */}
      <span aria-hidden className={`pointer-events-none absolute -top-2 left-0 h-px w-full bg-[#C8A664] transition-opacity motion-reduce:animate-none ${isPending ? 'animate-pulse opacity-100' : 'opacity-0'}`} />
      <fieldset>
        <legend className={section}>Dates</legend>
        {/* Two columns in the phone sheet (22rem); stacked in the 16rem rail,
            where a half-width pill clips the year of a native date value. */}
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
          <label className="block">
            <span className="block text-[10px] text-[#848A9A]">Pickup</span>
            <span className="relative mt-1 flex items-center">
              <CalendarDays size={14} className="pointer-events-none absolute left-2.5 text-[#C8A664]" aria-hidden />
              <input type="date" name="start" min={today} max={addDays(today, 180)} defaultValue={query.start ?? ''} aria-describedby={`${idPrefix}-dates-hint`} className={`${datePillClassName} w-full min-w-0`} />
            </span>
          </label>
          <label className="block">
            <span className="block text-[10px] text-[#848A9A]">Drop-off</span>
            <span className="relative mt-1 flex items-center">
              <CalendarDays size={14} className="pointer-events-none absolute left-2.5 text-[#C8A664]" aria-hidden />
              <input type="date" name="end" min={query.start ? addDays(query.start, 1) : addDays(today, 1)} max={addDays(today, 181)} defaultValue={query.end ?? ''} aria-describedby={`${idPrefix}-dates-hint`} className={`${datePillClassName} w-full min-w-0`} />
            </span>
          </label>
        </div>
        <p id={`${idPrefix}-dates-hint`} className="mt-2 text-[11px] text-[#848A9A]" aria-live="polite">{hint}</p>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-sort`} className={section}>Sort</label>
        <span className="relative mt-2 block">
          <select id={`${idPrefix}-sort`} name="sort" defaultValue={query.sort} className={selectClassName}>
            {MARKETPLACE_SORTS.map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#C8A664]" aria-hidden />
        </span>
      </div>

      <fieldset>
        <legend className={section}>City</legend>
        <div className="mt-2 space-y-0.5">
          <label className={option}>
            <span className="flex items-center gap-2.5"><input type="radio" name="city" value="" defaultChecked={!query.city} className="control-radio" />All cities</span>
          </label>
          {facets.cities.map((c) => (
            <label key={c.value} className={option}>
              <span className="flex items-center gap-2.5"><input type="radio" name="city" value={c.value} defaultChecked={query.city?.toLowerCase() === c.value.toLowerCase()} className="control-radio" />{c.label}</span>
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
                <span className="flex items-center gap-2.5"><input type="checkbox" name="type" value={t.value} defaultChecked={query.types.includes(t.value)} className="control-check" />{t.label}</span>
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
              <span className="flex items-center gap-2.5"><input type="checkbox" name="make" value={m.value} defaultChecked={query.makes.some((x) => x.toLowerCase() === m.value.toLowerCase())} className="control-check" />{m.label}</span>
              <span className={count}>{m.count}</span>
            </label>
          ))}
        </div>
      </fieldset>


      <fieldset>
        <legend className={section}>Daily rate</legend>
        <div className="mt-2 space-y-0.5">
          <label className={option}>
            <span className="flex items-center gap-2.5"><input type="radio" name="band" value="" defaultChecked={currentBand === ''} className="control-radio" />Any</span>
          </label>
          {facets.priceBands.map((b) => (
            <label key={b.value} className={option}>
              <span className="flex items-center gap-2.5"><input type="radio" name="band" value={b.value} defaultChecked={currentBand === b.value} className="control-radio" />{b.label}</span>
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
