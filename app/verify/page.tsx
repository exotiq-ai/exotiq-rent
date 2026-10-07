import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IdentityVerificationCard } from '@/components/drive-exotiq/IdentityVerificationCard';
import { PageFrame } from '@/components/browse/PageFrame';
import { getSiteMode } from '@/domain/booking/config';
import { getBookingConfirmation } from '@/domain/booking/service';
import { formatRangeLabel } from '@/domain/booking/dates';
import { microLabelClassName } from '@/components/browse/tokens';

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

type Props = { searchParams: Promise<{ ref?: string; token?: string; t?: string }> };

export default async function VerifyRoute({ searchParams: pendingSearch }: Props) {
  const searchParams = await pendingSearch;
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();

  const bookingRef = searchParams.ref?.trim();
  // The email sends ?token=; accept ?t= too so a renter who hand-edits from a
  // confirmation link (/booking/REF?t=…) still lands somewhere that works.
  const token = (searchParams.token ?? searchParams.t)?.trim();
  // The site bar's home before a booking resolves: no tenant is derivable yet, so the default
  // storefront (as the Problem link below). Once it resolves, that operator's own storefront (T-8).
  const defaultHome = `/${process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG ?? 'exotiq'}`;

  if (!bookingRef || !token) {
    return (
      <PageFrame homeHref={defaultHome}>
        <Problem
          title="This link is incomplete"
          body="Open the “Verify your ID” link directly from your email — it carries the secure access code for your booking."
        />
      </PageFrame>
    );
  }

  const lookup = await getBookingConfirmation(bookingRef, token);

  if (!lookup) {
    return (
      <PageFrame homeHref={defaultHome}>
        <Problem
          title="We couldn't find that booking"
          body={`No booking matches ${bookingRef}. Check the link in your email, or reply to that email and the operator will help.`}
        />
      </PageFrame>
    );
  }

  // D4: a ref that resolves but whose token doesn't match comes back
  // restricted. Treat it as an unusable link rather than leaking that the
  // ref itself is real.
  if ('restricted' in lookup) {
    return (
      <PageFrame homeHref={defaultHome}>
        <Problem
          title="This verification link has expired"
          body="For your security these links are tied to a single booking. Reply to your booking email and the operator will send a fresh one."
        />
      </PageFrame>
    );
  }

  const { live } = lookup;
  const dateLabel = live ? formatRangeLabel(live.startAt.slice(0, 10), live.endAt.slice(0, 10)) : undefined;

  return (
    <PageFrame homeHref={`/${lookup.team.slug}`}>
      <div className={`${microLabelClassName} text-faint`}>Booking {lookup.bookingRef}</div>
      <h1
        className="mt-3 text-heading leading-[1.1] tracking-[-0.01em] text-ink"
        style={{ fontFamily: 'var(--font-drive-playfair), Georgia, serif' }}
      >
        One last step.
      </h1>
      <p className="mt-2 text-body-sm leading-5 text-muted">
        Your payment went through. Verify your identity and {lookup.team.name} will have your{' '}
        {lookup.vehicle.make} {lookup.vehicle.model} confirmed.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-label">
        <Row label="Vehicle" value={`${lookup.vehicle.make} ${lookup.vehicle.model}`} />
        {dateLabel && <Row label="Dates" value={dateLabel} />}
        <Row label="Operator" value={lookup.team.name} />
      </div>

      <IdentityVerificationCard bookingRef={lookup.bookingRef} confirmationToken={token} />

      <Link
        href={`/booking/${encodeURIComponent(lookup.bookingRef)}?t=${encodeURIComponent(token)}`}
        className="mt-4 block text-center text-label text-faint underline decoration-line underline-offset-4"
      >
        View full booking details
      </Link>
    </PageFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <span className="text-faint">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <>
      <div className={`${microLabelClassName} text-faint`}>Identity verification</div>
      <h1
        className="mt-3 text-title leading-[1.15] tracking-[-0.01em] text-ink"
        style={{ fontFamily: 'var(--font-drive-playfair), Georgia, serif' }}
      >
        {title}
      </h1>
      <p className="mt-3 text-body-sm leading-5 text-muted">{body}</p>
      {/* Error path: no booking lookup succeeded, so no tenant is derivable —
          neutral copy, and the default storefront rather than a brand that may
          not be the operator the renter booked with (T-8). */}
      <Link
        href={`/${process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG ?? 'exotiq'}`}
        className="mt-6 inline-block rounded-xl border border-line px-5 py-3 text-body-sm font-semibold text-ink"
      >
        Back to the booking site
      </Link>
    </>
  );
}
