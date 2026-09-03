import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { serifStyle } from './tokens';

/**
 * A real zero-result state (MP-3). The cyan mockup silently fell back to
 * showing every car from every other city on an empty match — which is how
 * "New York (75 vehicles)" showed Scottsdale inventory. Never again.
 */
export function EmptyState({ totalInCatalog }: { totalInCatalog: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#2A2E3A] px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
      <h2 className="mt-5 text-[24px] text-[#F0F2F5]" style={serifStyle}>Nothing matches those filters yet.</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#9BA1B0]">
        {totalInCatalog} cars are listed across the fleet right now. Loosen a filter, or start over.
      </p>
      <Link href="/browse" className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">Clear filters</Link>
    </div>
  );
}
