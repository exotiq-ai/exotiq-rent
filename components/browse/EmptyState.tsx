import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { formatRangeLabel } from '@/domain/booking/dates';
import { serifStyle } from './tokens';

/**
 * A real zero-result state (MP-3). The cyan mockup silently fell back to
 * showing every car from every other city on an empty match — which is how
 * "New York (75 vehicles)" showed Scottsdale inventory. Never again.
 */
export function EmptyState({ totalInCatalog, dates }: { totalInCatalog: number; dates?: { start: string; end: string } }) {
  // Nothing listed at all is not a filter problem: the catalog read failed
  // for this window, or every tenant switched the marketplace off. Say so,
  // and do not offer "Clear filters" when there are none to clear.
  if (totalInCatalog === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#2A2E3A] px-6 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
        <h2 className="mt-5 text-[24px] text-[#F0F2F5]" style={serifStyle}>The fleet is being refreshed.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#9BA1B0]">No cars are listed right now. Give it a few minutes and try again.</p>
        <Link href="/browse" className="mt-6 rounded-xl border border-[#C8A664]/40 px-6 py-3.5 text-sm font-semibold text-[#C8A664]">Try again</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#2A2E3A] px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
      <h2 className="mt-5 text-[24px] text-[#F0F2F5]" style={serifStyle}>{dates ? `Nothing is available ${formatRangeLabel(dates.start, dates.end)}.` : 'Nothing matches those filters yet.'}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#9BA1B0]">
        {dates ? `Try different dates, or see all ${totalInCatalog} cars.` : `${totalInCatalog} cars are listed across the fleet right now. Loosen a filter, or start over.`}
      </p>
      <Link href="/browse" className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">{dates ? 'See all cars (clears dates)' : 'Clear filters'}</Link>
    </div>
  );
}
