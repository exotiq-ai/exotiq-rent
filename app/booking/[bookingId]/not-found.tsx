import Link from 'next/link';
import type { Metadata } from 'next';
import { LockKeyhole } from 'lucide-react';
import { HTitle, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';

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
    <div className={driveFontClassName}>
      <PhoneViewport step={8} className="font-[var(--font-drive-inter)]">
        <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]">
            <LockKeyhole size={24} />
          </div>
          <HTitle className="mt-5 text-[24px]">This booking needs its secure link.</HTitle>
          <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">
            Booking pages open only from the full link in your confirmation email — it carries a private
            access key, so the address alone won&apos;t do it. Open the most recent Drive Exotiq email and
            tap the button there.
          </p>
          <p className="mt-4 text-xs leading-5 text-[#848A9A]">
            Can&apos;t find the email? Reply to any Drive Exotiq message or call your operator and
            they&apos;ll resend it.
          </p>
          <Link href="/" className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">
            Browse the fleet
          </Link>
        </section>
      </PhoneViewport>
    </div>
  );
}
