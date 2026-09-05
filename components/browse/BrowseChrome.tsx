import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { FunnelEvent } from '@/components/analytics/posthog';
import { TrackView } from '@/components/analytics/TrackView';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { EmailCaptureForm } from '@/components/renters/EmailCaptureForm';
import { SavedLink } from '@/components/renters/SavedLink';
import { browseEnabled } from '@/domain/booking/config';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { SiteBar } from './SiteBar';
import { containerClassName, eyebrowClassName, groundClassName, serifStyle } from './tokens';

/**
 * Desktop-first marketplace chrome (MP-3): a quiet sticky header and a footer
 * that only links to things that exist. Layout ported from the cyan mockup's
 * nav/footer; rendered in the booking flow's gold editorial language.
 *
 * Footer links only to routes that exist: /terms and /privacy shipped with
 * M7e (MP-6), guarded by the same flag as /browse, so the link can never be
 * live while its target 404s.
 */
export function BrowseChrome({ children, view = 'browse_view', footerSignup = true }: { children: ReactNode; /** Funnel event fired on mount; null for pages that are not a funnel step (legal). */ view?: FunnelEvent | null; /** Off on the confirm/unsubscribe pages: no opt-in prompt inside an opt-out flow. */ footerSignup?: boolean }) {
  return (
    <div className={`${driveFontClassName} min-h-screen ${groundClassName} text-[#F0F2F5] font-[var(--font-drive-inter)]`}>
      <SiteBar homeHref="/browse" homeLabel="Drive Exotiq — browse the fleet">
        <div className="flex items-center gap-4">
          <p className={`hidden ${eyebrowClassName} text-[#848A9A] sm:block`}>Curated exotic &amp; luxury rentals</p>
          <SavedLink />
        </div>
      </SiteBar>
      <main>{children}</main>
      {view && <TrackView event={view} withQuery />}
      <footer className="mt-20 border-t border-[#2A2E3A]">
        {/* MP-14: the lowest-effort signup there is — one field, and the button is the consent. */}
        {renterCaptureUiEnabled() && footerSignup && (
          <div className={`${containerClassName} border-b border-[#2A2E3A] py-10`}>
            <div className="max-w-md">
              <p className={`${eyebrowClassName} text-[#848A9A]`}>First look</p>
              <h2 className="mt-2 text-[22px] text-[#F0F2F5]" style={serifStyle}>New cars, before they reach the grid.</h2>
              <EmailCaptureForm source="footer" cta="Keep me posted" consentImplied className="mt-4" />
            </div>
          </div>
        )}
        <div className={`${containerClassName} flex flex-col gap-6 py-10 text-[12px] text-[#848A9A] sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-4">
            <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="" width={80} height={16} style={{ height: 16, width: 'auto' }} className="opacity-70" aria-hidden />
            <span>© {new Date().getFullYear()} Drive Exotiq</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>Every car is rented from one accountable operator.</span>
            <Link href="/terms" className="transition hover:text-[#F0F2F5]">Terms</Link>
            <Link href="/privacy" className="transition hover:text-[#F0F2F5]">Privacy</Link>
            <a href="mailto:hello@exotiq.ai?subject=Listing%20my%20fleet%20on%20Drive%20Exotiq" className="text-[#C8A664] underline decoration-[#C8A664]/40 underline-offset-4 transition hover:decoration-[#C8A664]">Operators — list your fleet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
