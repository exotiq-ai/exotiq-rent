import Link from 'next/link';
import type { Metadata } from 'next';
import { LockKeyhole } from 'lucide-react';
import { HTitle } from '@/components/drive-exotiq/BookingChrome';
import { PageFrame } from '@/components/browse/PageFrame';
import { ctaClassName } from '@/components/browse/tokens';

export const metadata: Metadata = {
  title: 'Booking link required | Drive Exotiq',
  robots: { index: false, follow: false },
};

/**
 * Route-scoped 404 for confirmation links.
 *
 * `public_booking_by_ref` requires the confirmation token (backend fix for the
 * booking-ref enumeration finding, 2026-07-24), so a link that arrives without
 * its `?t=` — truncated by a mail client, or copied by hand — is
 * indistinguishable from a booking that does not exist. By far the likelier
 * cause is the missing token, so guide toward the secure link instead of the
 * generic "wrong turn" page.
 */
export default function BookingNotFound() {
  return (
    <PageFrame homeHref={`/${process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG ?? 'exotiq'}`}>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-muted">
          <LockKeyhole size={24} />
        </div>
        <HTitle className="mt-5 text-title">This booking needs its secure link.</HTitle>
        <p className="mt-3 text-body leading-6 text-muted">
          Booking pages open only from the full link in your confirmation email — it carries a private
          access key, so the address alone won&apos;t do it. Open your most recent booking email and
          tap the button there.
        </p>
        <p className="mt-4 text-body-sm leading-5 text-faint">
          Can&apos;t find the email? Reply to your booking confirmation or call your operator and
          they&apos;ll resend it.
        </p>
        <Link href={`/${process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG ?? 'exotiq'}`} className={`mt-6 rounded-xl px-6 py-3.5 text-body font-semibold ${ctaClassName}`}>
          Continue browsing
        </Link>
      </section>
    </PageFrame>
  );
}
