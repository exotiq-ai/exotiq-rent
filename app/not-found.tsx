import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { HTitle } from '@/components/drive-exotiq/BookingChrome';
import { PageFrame } from '@/components/browse/PageFrame';
import { ctaClassName } from '@/components/browse/tokens';
import { getSiteMode } from '@/domain/booking/config';

export default function NotFound() {
  // Booking mode: land on the default tenant's storefront via the same env the
  // root redirect uses. The old hardcoded '/desert-exotic-rentals' was the MOCK
  // tenant's slug — a live 404 whose only CTA looped straight back to itself
  // (T-8, verified live). "Continue browsing", not "Browse the fleet": with
  // multiple operators there is no single fleet to promise.
  const home = getSiteMode() === 'marketplace'
    ? { href: '/', label: 'Back to Drive Exotiq' }
    : { href: `/${process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG ?? 'exotiq'}`, label: 'Continue browsing' };
  return (
    <PageFrame homeHref={home.href}>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-muted"><CarFront size={24} /></div>
        <HTitle className="mt-5 text-title">This page took a wrong turn.</HTitle>
        <p className="mt-3 text-body leading-6 text-muted">The vehicle, operator, or booking you&apos;re looking for isn&apos;t here. It may have been moved or is no longer listed.</p>
        <Link href={home.href} className={`mt-6 rounded-xl px-6 py-3.5 text-body font-semibold ${ctaClassName}`}>{home.label}</Link>
      </section>
    </PageFrame>
  );
}
