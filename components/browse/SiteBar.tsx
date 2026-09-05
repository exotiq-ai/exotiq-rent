import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { containerClassName } from './tokens';

/**
 * The one site bar (MP-12): sticky, blurred, the Drive Exotiq lockup on the
 * left, whatever the page needs on the right. Rendered by the browse chrome
 * and by the booking frame's desktop layout, so the header exists once.
 * The lockup's alt names the link unless the page passes a truer label.
 */
export function SiteBar({ homeHref, homeLabel, className = '', children }: { homeHref: string; homeLabel?: string; className?: string; children?: ReactNode }) {
  return (
    <header className={`sticky top-0 z-40 border-b border-[#2A2E3A]/70 bg-[#06070a]/85 backdrop-blur-md ${className}`}>
      <div className={`${containerClassName} flex h-16 items-center justify-between gap-6`}>
        <Link href={homeHref} className="flex items-center" aria-label={homeLabel}>
          <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="Drive Exotiq" width={100} height={20} priority style={{ height: 20, width: 'auto' }} className="opacity-95" />
        </Link>
        {children}
      </div>
    </header>
  );
}
