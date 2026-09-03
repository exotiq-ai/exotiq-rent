import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InterimNotice, LegalPage } from '@/components/browse/LegalPage';
import { browseEnabled } from '@/domain/booking/config';
import { posthogKey } from '@/components/analytics/posthog';

// Guarded with the marketplace — see app/terms/page.tsx.
export function generateMetadata(): Metadata {
  if (!browseEnabled()) notFound();
  return {
    title: 'Privacy | Drive Exotiq',
    description: 'What Drive Exotiq collects when you browse and book, who it is shared with, and why.',
    robots: { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  // Stated only when it is true for this deploy: a host without a PostHog key
  // runs no analytics, and the policy must not claim otherwise.
  const analytics = Boolean(posthogKey());
  return (
    <LegalPage eyebrow="Drive Exotiq" title="Privacy" updated="3 September 2026">
      <InterimNotice what="This page lists what the service actually collects today and who receives it." />

      <section>
        <h2>What we collect when you book</h2>
        <p>
          Your name, date of birth, phone number and email address, and the dates, pickup time and car you request.
          These go to the operator you are renting from — they need them to prepare the rental — and to Exotiq to run
          the booking.
        </p>
      </section>

      <section>
        <h2>Identity verification</h2>
        <p>
          Driver identity is verified by <strong>Stripe Identity</strong>: the document and selfie you provide are
          processed by Stripe under its own privacy terms. Exotiq and the operator receive the result (verified or
          not), not the images.
        </p>
      </section>

      <section>
        <h2>Payment</h2>
        <p>
          Card details are entered on Stripe&apos;s hosted payment page and never touch Exotiq&apos;s servers. Exotiq
          receives the payment status and the last four digits for your receipt.
        </p>
      </section>

      <section>
        <h2>Browsing</h2>
        <p>
          {analytics
            ? 'This site uses PostHog to measure how the marketplace is used — which pages are viewed and where bookings start and stop. It is not used to identify you by name; it does not run on the booking, payment or verification pages beyond recording that a step was reached.'
            : 'This host runs no analytics or advertising trackers.'}{' '}
          Photos and listing data are served from Exotiq&apos;s infrastructure (Supabase, Netlify).
        </p>
      </section>

      <section>
        <h2>Confirmation links</h2>
        <p>
          Your confirmation page is reachable only through the secure link in your email, which carries its own access
          key. Anyone with the link can see the booking, so treat it like a ticket.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          To correct or delete your details, or to ask what we hold, email <a href="mailto:hello@exotiq.ai">hello@exotiq.ai</a>{' '}
          from the address on the booking. Operators keep their own records under their own policies.
        </p>
      </section>
    </LegalPage>
  );
}
