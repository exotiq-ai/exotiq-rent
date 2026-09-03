import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { EmptyState } from '@/components/browse/EmptyState';
import { FilterForm } from '@/components/browse/FilterForm';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { containerClassName, serifStyle } from '@/components/browse/tokens';
import { getSiteMode } from '@/domain/booking/config';
import { parseMarketplaceQuery, toMarketplaceSearchParams, type SearchParamsLike } from '@/domain/booking/marketplaceQuery';
import { getMarketplaceFacets, getMarketplaceListings } from '@/domain/booking/service';

export const metadata: Metadata = {
  title: 'Browse the fleet | Drive Exotiq',
  description: 'Every exotic and luxury car on Drive Exotiq, across every operator — each one rented from a single accountable business.',
  // Staging-only until the SEO pass (M7e / MP-6) turns indexing on per host.
  robots: { index: false, follow: false },
};

/**
 * Cross-tenant browse (MP-3 / M7b).
 *
 * Ships WITH its guard: this route is live on every deploy of `main` the
 * moment it merges, and on demo.exotiq.rent (mock mode) it would publish
 * three fictitious operators as real inventory. Absence of the env flag
 * means 404 — set it only on the staging site until launch.
 */
function browseEnabled(): boolean {
  return getSiteMode() === 'booking' && process.env.NEXT_PUBLIC_MARKETPLACE_BROWSE === 'on';
}

export default async function BrowsePage({ searchParams }: { searchParams: SearchParamsLike }) {
  if (!browseEnabled()) notFound();

  const query = parseMarketplaceQuery(searchParams);
  const [page, facets] = await Promise.all([getMarketplaceListings(query), getMarketplaceFacets()]);
  const catalogTotal = facets.cities.reduce((n, c) => n + c.count, 0);
  const activeFilters = (query.city ? 1 : 0) + query.makes.length + (query.minDailyRateCents !== undefined || query.maxDailyRateCents !== undefined ? 1 : 0);

  const pageLink = (offset: number) => {
    const params = toMarketplaceSearchParams({ ...query, offset });
    const qs = params.toString();
    return qs ? `/browse?${qs}` : '/browse';
  };
  const hasPrev = query.offset > 0;
  const hasNext = query.offset + query.limit < page.totalCount;

  return (
    <BrowseChrome>
      <section className={`${containerClassName} pb-6 pt-12 sm:pt-16`}>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#848A9A]">Drive Exotiq</p>
        <h1 className="mt-3 text-[40px] leading-[1.02] text-[#F0F2F5] sm:text-[56px]" style={{ ...serifStyle, letterSpacing: '-0.02em' }}>
          The fleet.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#9BA1B0]">
          {catalogTotal} cars across {facets.cities.length} {facets.cities.length === 1 ? 'city' : 'cities'} — every one rented from a single
          accountable operator, booked in a few taps.
        </p>
      </section>

      <section className={`${containerClassName} lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10`}>
        {/* Desktop: a sticky rail. Mobile: the same form inside a native
            <details> sheet — no client state, no hydration risk, keyboard-safe. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-[#2A2E3A] bg-[#0D0F14] p-5">
            <FilterForm facets={facets} query={query} idPrefix="rail" />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#848A9A]">
              {page.totalCount} {page.totalCount === 1 ? 'car' : 'cars'}
              {activeFilters > 0 && <span className="ml-2 text-[#C8A664]">· {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}</span>}
            </div>
            <details className="relative lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[#2A2E3A] bg-[#161922] px-3.5 py-2 text-[12px] font-semibold text-[#F0F2F5] [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal size={14} className="text-[#C8A664]" /> Filters &amp; sort
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-[#2A2E3A] bg-[#0D0F14] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]">
                <FilterForm facets={facets} query={query} idPrefix="sheet" />
              </div>
            </details>
          </div>

          {page.listings.length > 0 ? <ListingGrid listings={page.listings} /> : <EmptyState totalInCatalog={catalogTotal} />}

          {(hasPrev || hasNext) && (
            <nav className="mt-10 flex items-center justify-between text-[13px]" aria-label="Pagination">
              {hasPrev ? (
                <Link href={pageLink(Math.max(0, query.offset - query.limit))} className="rounded-lg border border-[#2A2E3A] px-4 py-2 text-[#F0F2F5] transition hover:border-[#C8A664]/45">← Previous</Link>
              ) : <span />}
              <span className="text-[#848A9A] tabular-nums">
                {query.offset + 1}–{Math.min(query.offset + query.limit, page.totalCount)} of {page.totalCount}
              </span>
              {hasNext ? (
                <Link href={pageLink(query.offset + query.limit)} className="rounded-lg border border-[#2A2E3A] px-4 py-2 text-[#F0F2F5] transition hover:border-[#C8A664]/45">Next →</Link>
              ) : <span />}
            </nav>
          )}
        </div>
      </section>
    </BrowseChrome>
  );
}
