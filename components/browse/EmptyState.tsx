import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { formatRangeLabel } from '@/domain/booking/dates';
import { EmailCaptureForm } from '@/components/renters/EmailCaptureForm';
import { serifStyle } from './tokens';

/**
 * A real zero-result state (MP-3). The cyan mockup silently fell back to
 * showing every car from every other city on an empty match — which is how
 * "New York (75 vehicles)" showed Scottsdale inventory. Never again.
 */
export function EmptyState({
  totalInCatalog,
  dates,
  clearHref = '/browse',
  ownerName,
  alertTeamSlug = null,
}: {
  totalInCatalog: number;
  dates?: { start: string; end: string };
  /** Where "see all" goes: /browse on the marketplace, the storefront root on a storefront (MP-12). */
  clearHref?: string;
  /** Set on a storefront: copy names the operator and the alert is scoped to them. */
  ownerName?: string;
  alertTeamSlug?: string | null;
}) {
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
      <h2 className="mt-5 text-[24px] text-[#F0F2F5]" style={serifStyle}>{dates ? `Nothing is available ${formatRangeLabel(dates.start, dates.end)}.` : ownerName ? 'No cars match those filters.' : 'Nothing matches those filters yet.'}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#9BA1B0]">
        {dates
          ? `Try different dates, or see all ${totalInCatalog} cars${ownerName ? ` ${ownerName} lists` : ''}.`
          : ownerName
            ? `${ownerName} lists ${totalInCatalog} cars right now. Loosen a filter, or see them all.`
            : `${totalInCatalog} cars are listed across the fleet right now. Loosen a filter, or start over.`}
      </p>
      <Link href={clearHref} className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">{dates ? `See all cars${ownerName ? '' : ''} (clears dates)` : ownerName ? `Show all ${totalInCatalog}` : 'Clear filters'}</Link>
      {/* MP-14: one e-mail if a car frees up for the dates — any listed car, or this operator's. */}
      {dates && (
        <div className="mt-8 w-full max-w-sm border-t border-[#2A2E3A] pt-6 text-left">
          <p className="text-[13px] text-[#9BA1B0]">Get one e-mail if a car{ownerName ? ` from ${ownerName}` : ''} opens up {formatRangeLabel(dates.start, dates.end)}.</p>
          <EmailCaptureForm source="alert" cta="Alert me" compact teamSlug={alertTeamSlug ?? undefined} alert={{ team_slug: alertTeamSlug, vehicle_slug: null, start: dates.start, end: dates.end }} className="mt-3" />
        </div>
      )}
    </div>
  );
}
