import type { ReactNode } from 'react';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { SiteBar } from './SiteBar';
import { groundClassName } from './tokens';

/**
 * The plain page frame (MP-17) for pages that are not a booking step: the two 404s and the
 * identity-verification landing. The lit ground at full width, the one site bar at every width,
 * natural document scroll, and a centred content column. A server component: the site bar is the
 * client island. These are private routes, so the frame mounts no consent control and no
 * analytics.
 */
export function PageFrame({ homeHref, children }: { homeHref: string; children: ReactNode }) {
  return (
    <div data-chrome="page-frame" className={`${driveFontClassName} flex min-h-dvh flex-col ${groundClassName} text-ink font-[var(--font-drive-inter)]`}>
      <SiteBar homeHref={homeHref} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-10 sm:px-6">{children}</main>
    </div>
  );
}
