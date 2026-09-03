import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InterimNotice, LegalPage } from '@/components/browse/LegalPage';
import { browseEnabled } from '@/domain/booking/config';

// Guarded with the marketplace: the storefront hosts show nothing that links
// here until launch, and an interim legal page must not be discoverable
// before the counsel pass lands (MARKETPLACE_LAUNCH_CHECKLIST.md §Legal).
export function generateMetadata(): Metadata {
  if (!browseEnabled()) notFound();
  return {
    title: 'Terms of service | Drive Exotiq',
    description: 'How booking through Drive Exotiq works: who you rent from, what you pay, and what Exotiq is responsible for.',
    robots: { index: false, follow: true },
  };
}

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Drive Exotiq" title="Terms of service" updated="3 September 2026">
      <InterimNotice what="These terms describe how the service works today, in plain language." />

      <section>
        <h2>What Drive Exotiq is</h2>
        <p>
          Drive Exotiq is a booking platform operated by Exotiq. Every car on it is owned and rented out by an
          independent rental operator (the <strong>operator</strong>). You rent the car from the operator; Exotiq
          arranges the booking, verifies drivers, and collects its own charges separately.
        </p>
      </section>

      <section>
        <h2>Your rental agreement is with the operator</h2>
        <p>
          The operator&apos;s rental agreement — which you sign at pickup — governs the rental itself: eligibility,
          deposits, mileage, fuel, damage, and returns. Each storefront shows the operator&apos;s policies before you
          book. Exotiq is not a party to that agreement and does not own, insure, or hand over the vehicle.
        </p>
      </section>

      <section>
        <h2>What you pay, and to whom</h2>
        <p>
          Before you pay, the review step lists every charge as a separate line: the operator&apos;s rental charge and
          any tax the operator collects, and Exotiq&apos;s charges — the platform fee, the optional protection plan if you
          keep it, applicable state rental fees, and payment processing. The two are charged separately and appear
          separately on your statement (Exotiq&apos;s as <strong>EXOTIQ RENT</strong>). A refundable damage deposit, if the
          operator requires one, is collected by the operator at pickup and is never handled by Exotiq.
        </p>
      </section>

      <section>
        <h2>Requests, approval and cancellation</h2>
        <p>
          A booking is a request until the operator accepts it. You are not charged until the operator approves and you
          complete payment from the link we email you. Cancellation terms are shown on the review step and on your
          confirmation; where a booking is cancelled inside the operator&apos;s free-cancellation window, the operator&apos;s
          charge is refunded in full and Exotiq&apos;s charges are refunded except for payment processing, which the card
          networks do not return.
        </p>
      </section>

      <section>
        <h2>Identity verification</h2>
        <p>
          Every driver verifies their identity through Stripe Identity before pickup. The operator may decline a
          rental that does not meet its eligibility rules, in which case you are refunded as above.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about a booking go to the operator named on your confirmation. Questions about Drive Exotiq go to{' '}
          <a href="mailto:hello@exotiq.ai">hello@exotiq.ai</a>.
        </p>
      </section>
    </LegalPage>
  );
}
