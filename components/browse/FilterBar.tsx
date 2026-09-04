'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { MARKETPLACE_SORTS, PRICE_BANDS, daysBetween } from '@/domain/booking/marketplaceQuery';
import { addDays } from '@/domain/booking/dates';
import { localTodayIso } from '@/domain/booking/availability';
import { datePillClassName } from './tokens';

function datesHint(start: string, end: string): string {
  if (start && end) return 'Cars shown are free for these dates.';
  if (start) return 'Add a drop-off date to filter by availability.';
  if (end) return 'Add a pickup date to filter by availability.';
  return 'Pick pickup and drop-off days to see what is free.';
}

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
  // MP-12: a chip flipped and then nothing happened for the RPC round-trip.
  // The push runs in a transition so the form knows it is pending: a gold
  // hairline at the top and dimmed controls until the new grid commits.
  const [isPending, startTransition] = useTransition();

  const currentBand = PRICE_BANDS.find(
    (b) => b.minCents === (query.minDailyRateCents ?? 0) && b.maxCents === query.maxDailyRateCents,
  )?.value ?? '';
  const hasWindow = Boolean(query.start && query.end);
  const active = query.makes.length + query.types.length + (currentBand ? 1 : 0) + (hasWindow ? 1 : 0);
  const today = localTodayIso();
  const [hint, setHint] = useState(() => datesHint(query.start ?? '', query.end ?? ''));

  // Keep the drop-off picker honest as the pickup moves, and never submit an
  // inverted pair: pushing pickup past drop-off carries the rental length
  // forward instead of wiping the renter's dates.
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
  // Price bands are contiguous and inclusive, so their counts sum to the fleet.
  const fleetSize = facets.priceBands.reduce((n, b) => n + b.count, 0);
  // A lone type chip only earns its place when it can narrow the result —
  // i.e. some cars are still unclassified. One type across the whole fleet
  // would toggle between N of N and N of N.
  const typesNarrow = facets.types.length > 1 || (facets.types.length === 1 && facets.types[0].count < fleetSize);

  const navigate = () => {
    if (!form.current) return;
    // Dates apply as a pair: with only one picked, wait for the other (the
    // hint says so) instead of navigating to a URL the parser would drop.
    const { start, end } = reconcileDates();
    if ((start === '') !== (end === '')) return;
    const data = new FormData(form.current);
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value !== 'string' || value === '') return;
      if (key === 'sort' && value === 'featured') return;
      params.append(key, value);
    });
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action));
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

  const row = 'flex flex-wrap items-center gap-2';
  const label = 'mr-1 text-[10px] uppercase tracking-[0.16em] text-[#848A9A]';
  const chip = 'relative cursor-pointer group-data-[pending]:opacity-60 group-data-[pending]:cursor-progress transition-opacity';
  const face =
    'inline-flex select-none items-center gap-1.5 rounded-full border border-[#3A3F4D] bg-[#10131A] px-3 py-1.5 text-[12px] text-[#9BA1B0] transition active:scale-[0.97] active:bg-[#C8A664]/15 ' +
    'peer-checked:border-[#C8A664]/70 peer-checked:bg-[#C8A664]/10 peer-checked:font-semibold peer-checked:text-[#F0F2F5] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C8A664]/60 hover:border-[#C8A664]/40 hover:text-[#F0F2F5]';
  const count = 'text-[10px] tabular-nums text-[#848A9A]';

  return (
    <form ref={form} method="get" action={action} onSubmit={onSubmit} onChange={navigate} className="group relative space-y-2.5" aria-busy={isPending} data-pending={isPending ? '' : undefined} aria-label="Filter the fleet">
      {/* Always mounted, opacity-toggled, so the rail never jumps. */}
      <span aria-hidden className={`pointer-events-none absolute -top-2 left-0 h-px w-full bg-[#C8A664] transition-opacity motion-reduce:animate-none ${isPending ? 'animate-pulse opacity-100' : 'opacity-0'}`} />
      <div className={row} role="group" aria-labelledby={`${idPrefix}-dates-label`}>
        <span id={`${idPrefix}-dates-label`} className={`${label} basis-full sm:basis-auto`}>Dates</span>
        {/* The trio wraps as one unit, so a phone never shows a dangling "to". */}
        <span className="flex flex-nowrap items-center gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-start`}>Pickup date</label>
          <span className="relative inline-flex items-center">
            <CalendarDays size={14} className="pointer-events-none absolute left-2.5 text-[#C8A664]" aria-hidden />
            <input id={`${idPrefix}-start`} type="date" name="start" min={today} max={addDays(today, 180)} defaultValue={query.start ?? ''} aria-describedby={`${idPrefix}-dates-hint`} className={`${datePillClassName} min-w-[8.5rem]`} />
          </span>
          <span className="text-[11px] text-[#848A9A]">to</span>
          <label className="sr-only" htmlFor={`${idPrefix}-end`}>Drop-off date</label>
          <span className="relative inline-flex items-center">
            <CalendarDays size={14} className="pointer-events-none absolute left-2.5 text-[#C8A664]" aria-hidden />
            <input id={`${idPrefix}-end`} type="date" name="end" min={query.start ? addDays(query.start, 1) : addDays(today, 1)} max={addDays(today, 181)} defaultValue={query.end ?? ''} aria-describedby={`${idPrefix}-dates-hint`} className={`${datePillClassName} min-w-[8.5rem]`} />
          </span>
        </span>
        <p id={`${idPrefix}-dates-hint`} className="basis-full text-[11px] text-[#848A9A]" aria-live="polite">{hint}</p>
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
            {hasWindow && active === 1 ? 'Clear dates' : `Clear ${active === 1 ? 'filter' : 'filters'}`}
          </Link>
        )}
        <noscript>
          <button type="submit" className="rounded-full border border-[#C8A664]/40 px-3 py-1.5 text-[12px] font-semibold text-[#C8A664]">Apply</button>
        </noscript>
      </div>
    </form>
  );
}
