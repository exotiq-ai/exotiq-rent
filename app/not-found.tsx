import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { HTitle } from '@/components/drive-exotiq/BookingChrome';
import { PageFrame } from '@/components/browse/PageFrame';
import { ctaClassName } from '@/components/browse/tokens';
import { homeLink } from '@/domain/booking/config';

export default function NotFound() {
  // Tenant-neutral home (T-8): the old hardcoded mock tenant slug made a live 404 whose only CTA
  // looped back to itself. The rule lives in homeLink(), shared with the error boundary (MP-18).
  const home = homeLink();
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
