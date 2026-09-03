import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { containerClassName } from './tokens';

/**
 * Desktop-first marketplace chrome (MP-3): a quiet sticky header and a footer
 * that only links to things that exist. Layout ported from the cyan mockup's
 * nav/footer; rendered in the booking flow's gold editorial language.
 *
 * Deliberately no legal links yet — /terms and /privacy arrive with M7e (MP-6);
 * a dead footer link is the exact audit class this program keeps removing.
 */
export function BrowseChrome({ children }: { children: ReactNode }) {
  return (
    <div className={`${driveFontClassName} min-h-screen bg-[#06070a] text-[#F0F2F5] font-[var(--font-drive-inter)]`}>
      <header className="sticky top-0 z-40 border-b border-[#2A2E3A]/70 bg-[#06070a]/85 backdrop-blur-md">
        <div className={`${containerClassName} flex h-16 items-center justify-between gap-6`}>
          <Link href="/browse" className="flex items-center" aria-label="Drive Exotiq — browse the fleet">
            <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="Drive Exotiq" width={100} height={20} priority style={{ height: 20, width: 'auto' }} className="opacity-95" />
          </Link>
          <p className="hidden text-[11px] uppercase tracking-[0.22em] text-[#848A9A] sm:block">Curated exotic &amp; luxury rentals</p>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-20 border-t border-[#2A2E3A]">
        <div className={`${containerClassName} flex flex-col gap-6 py-10 text-[12px] text-[#848A9A] sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-4">
            <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="" width={80} height={16} style={{ height: 16, width: 'auto' }} className="opacity-70" aria-hidden />
            <span>© {new Date().getFullYear()} Drive Exotiq</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>Every car is rented from one accountable operator.</span>
            <a href="mailto:hello@exotiq.ai?subject=Listing%20my%20fleet%20on%20Drive%20Exotiq" className="text-[#C8A664] underline decoration-[#C8A664]/40 underline-offset-4 transition hover:decoration-[#C8A664]">Operators — list your fleet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
