import type { Metadata } from 'next';
import { InterimNotice, LegalPage } from '@/components/browse/LegalPage';

import { renterCaptureUiEnabled } from '@/domain/renters/flags';

// Tracking choices must remain available even when cross-tenant browse is off.
export function generateMetadata(): Metadata {
  return {
    title: 'Privacy | Drive Exotiq',
    description: 'What Drive Exotiq collects when you browse and book, who it is shared with, and why.',
    robots: { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  const tracking = process.env.NEXT_PUBLIC_TRACKING_ENABLED === 'true';
  const analytics = tracking && /^phc_[a-zA-Z0-9]+$/.test(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '');
  const advertising = tracking && Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  // Same rule for renter e-mail (MP-14): described only on a host that runs it.
  const capture = renterCaptureUiEnabled();
  return (
    <LegalPage eyebrow="Drive Exotiq" title="Privacy" updated="17 September 2026">
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
        <h2>Browsing, analytics and advertising</h2>
        <p>
          {analytics
            ? 'If you allow analytics, PostHog measures public page views and the steps leading to a booking request. It uses browser identifiers and permitted campaign information to connect those visits; we do not identify you by name or send driver-form values to PostHog.'
            : 'PostHog analytics is not enabled on this host.'}{' '}
          Photos and listing data are served from Exotiq&apos;s infrastructure (Supabase, Netlify).
        </p>
        <p className="mt-3">
          {advertising
            ? 'If you separately allow advertising, the Meta Pixel reports public page views, vehicle views and successfully submitted booking requests to Meta to help measure and improve our Facebook and Instagram ads. Meta may receive browser and network information, page addresses and advertising identifiers, and may associate these with your Meta account under its own privacy policy.'
            : 'Meta advertising measurement is not enabled on this host.'}
        </p>
        <p className="mt-3">
          Session recording is disabled. We do not load these tracking tools on private confirmation, payment,
          identity-verification, or token-protected saved-list pages. Booking-access tokens, dates of birth,
          driver documents, card details and the values entered in driver forms are not included in our analytics events.
          A submitted booking request is not reported as a paid purchase.
        </p>
        <p className="mt-3">
          Use <strong>Privacy preferences</strong> to allow or reject analytics and advertising independently, or to
          change your choice later. Neither is required to browse or request a booking. A Global Privacy Control
          signal disables advertising tracking. Your choice is separate from any opt-in to marketing e-mail.
          Withdrawing permission stops future collection in this browser; to request deletion of earlier data,
          contact us using the details below. Learn more in{' '}
          <a href="https://posthog.com/privacy" rel="noreferrer" target="_blank">PostHog&apos;s privacy policy</a> and{' '}
          <a href="https://www.facebook.com/privacy/policy/" rel="noreferrer" target="_blank">Meta&apos;s privacy policy</a>.
        </p>
      </section>

      {capture && (
        <section>
          <h2>Saved cars, alerts and e-mail you ask for</h2>
          <p>
            Tapping the heart keeps a list of cars in your browser only. If you ask us to e-mail that list, set an
            availability alert, tick the box for first looks at new cars, or press the &ldquo;Keep me posted&rdquo;
            button, we keep in Exotiq&apos;s own database (Supabase, separate from the operators&apos; systems): your
            e-mail address; your name when it comes from a booking; the booking references and how
            many bookings you have made; what you asked for, when, and on which page; the exact wording you agreed to
            (by version); a keyed hash of your IP address (used to limit abuse of the forms, and kept with a consent
            as evidence of it) and your browser&apos;s user-agent string; and a log of the e-mails we sent you. An
            address that never confirms is deleted after thirty days; otherwise we keep this until you ask us to
            delete it.
          </p>
          <p>
            We send nothing but a confirmation link until you confirm the address by pressing the button on that
            page, and the page says exactly what the click confirms; a booking you make may count as confirming the
            address once the booking system can match it to you. Marketing e-mail goes out only after you have asked
            for it and confirmed it. Pressing &ldquo;Keep me posted&rdquo; is the request; the confirmation click is the opt-in, and
            the words you agreed to are the ones printed under that button and repeated in the e-mail. Every message
            carries an unsubscribe link and one-click unsubscribe headers; unsubscribing stops all e-mail from us and
            turns off any alerts, and pressing the confirmation link again later resumes only what you ask for. E-mail
            is delivered by Resend; the daily availability check runs on Netlify. Unsubscribing does not delete your
            record: to have it deleted, write to <a href="mailto:hello@exotiq.ai">hello@exotiq.ai</a> from that
            address.
          </p>
        </section>
      )}

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
