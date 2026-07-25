import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IdentityVerificationCard } from '@/components/drive-exotiq/IdentityVerificationCard';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getBookingConfirmation } from '@/domain/booking/service';
import { formatRangeLabel } from '@/domain/booking/dates';

/**
 * Landing page for the `verifyIdRequested` drip email, which links to
 * /verify?ref=…&token=… (built by rent-payment-webhook when a booking is paid
 * but the renter is not yet ID-verified, parking it at `pending_documents`).
 *
 * The renter typically arrives here on a different device from the one they
 * booked on, so nothing may be carried in session — the token in the link is
 * the only credential, and it is what identity-create-session requires.
 *
 * Deliberately NOT an auto-redirect to Stripe: a bare redirect on page load
 * would fire before the renter has any idea what they're being asked for, and
 * a failed/abandoned session would bounce them to a Stripe error page with no
 * route back. They get context first, then tap.
 */

export const metadata: Metadata = {
  title: 'Verify your identity | Drive Exotiq',
  description: 'Confirm your Drive Exotiq booking by verifying your identity.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: { ref?: string; token?: string; t?: string } };

export default async function VerifyRoute({ searchParams }: Props) {
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();

  const bookingRef = searchParams.ref?.trim();
  // The email sends ?token=; accept ?t= too so a renter who hand-edits from a
  // confirmation link (/booking/REF?t=…) still lands somewhere that works.
  const token = (searchParams.token ?? searchParams.t)?.trim();

  if (!bookingRef || !token) {
    return (
      <VerifyShell>
        <Problem
          title="This link is incomplete"
          body="Open the “Verify your ID” link directly from your email — it carries the secure access code for your booking."
        />
      </VerifyShell>
    );
  }

  const lookup = await getBookingConfirmation(bookingRef, token);

  if (!lookup) {
    return (
      <VerifyShell>
        <Problem
          title="We couldn't find that booking"
          body={`No booking matches ${bookingRef}. Check the link in your email, or reply to that email and the operator will help.`}
        />
      </VerifyShell>
    );
  }

  // D4: a ref that resolves but whose token doesn't match comes back
  // restricted. Treat it as an unusable link rather than leaking that the
  // ref itself is real.
  if ('restricted' in lookup) {
    return (
      <VerifyShell>
        <Problem
          title="This verification link has expired"
          body="For your security these links are tied to a single booking. Reply to your booking email and the operator will send a fresh one."
        />
      </VerifyShell>
    );
  }

  const { live } = lookup;
  const dateLabel = live ? formatRangeLabel(live.startAt.slice(0, 10), live.endAt.slice(0, 10)) : undefined;

  return (
    <VerifyShell>
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#848A9A]">Booking {lookup.bookingRef}</div>
      <h1
        className="mt-3 text-[26px] leading-[1.1] tracking-[-0.01em] text-[#F0F2F5]"
        style={{ fontFamily: 'var(--font-drive-playfair), Georgia, serif' }}
      >
        One last step.
      </h1>
      <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">
        Your payment went through. Verify your identity and {lookup.team.name} will have your{' '}
        {lookup.vehicle.make} {lookup.vehicle.model} confirmed.
      </p>

      <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-[11px]">
        <Row label="Vehicle" value={`${lookup.vehicle.make} ${lookup.vehicle.model}`} />
        {dateLabel && <Row label="Dates" value={dateLabel} />}
        <Row label="Operator" value={lookup.team.name} />
      </div>

      <IdentityVerificationCard bookingRef={lookup.bookingRef} confirmationToken={token} />

      <Link
        href={`/booking/${encodeURIComponent(lookup.bookingRef)}?t=${encodeURIComponent(token)}`}
        className="mt-4 block text-center text-[11px] text-[#848A9A] underline decoration-[#2A2E3A] underline-offset-4"
      >
        View full booking details
      </Link>
    </VerifyShell>
  );
}

function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={driveFontClassName}>
      <main
        className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#0D0F14] px-5 py-10"
        style={{ fontFamily: 'var(--font-drive-inter), system-ui, sans-serif' }}
      >
        {children}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#2A2E3A] py-2 last:border-b-0">
      <span className="text-[#848A9A]">{label}</span>
      <span className="text-right text-[#F0F2F5]">{value}</span>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#848A9A]">Identity verification</div>
      <h1
        className="mt-3 text-[24px] leading-[1.15] tracking-[-0.01em] text-[#F0F2F5]"
        style={{ fontFamily: 'var(--font-drive-playfair), Georgia, serif' }}
      >
        {title}
      </h1>
      <p className="mt-3 text-[13px] leading-5 text-[#9BA1B0]">{body}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl border border-[#2A2E3A] px-5 py-3 text-xs font-semibold text-[#F0F2F5]"
      >
        Back to Drive Exotiq
      </Link>
    </>
  );
}
