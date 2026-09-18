import type { Metadata } from 'next';
import { LegalPage } from '@/components/browse/LegalPage';
import { CookieControls } from '@/components/analytics/CookieControls';

import { renterCaptureUiEnabled } from '@/domain/renters/flags';

// Tracking choices must remain available even when cross-tenant browse is off.
export function generateMetadata(): Metadata {
  return {
    title: 'Privacy | Drive Exotiq',
    description: 'What Drive Exotiq collects when you browse and book, who it is shared with, and the choices you have.',
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
    <LegalPage eyebrow="Drive Exotiq" title="Privacy" updated="18 September 2026">
      <section>
        <p>
          Drive Exotiq is a booking platform operated by Exotiq. This notice explains what we collect when you browse
          and book, who receives it, and the choices you have. Every car is rented from an independent operator, who
          keeps their own records under their own policies. The service is offered in the United States.
        </p>
      </section>

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
        <h2>Analytics and advertising</h2>
        <p>
          {analytics
            ? 'Unless you turn analytics off, PostHog measures public page views and the steps leading to a booking request. It uses browser identifiers and permitted campaign information (including the click identifier a Facebook or Instagram ad adds to the address) to connect those visits; we do not identify you by name and never send driver-form values to PostHog.'
            : 'PostHog analytics is not enabled on this host.'}{' '}
          Photos and listing data are served from Exotiq&apos;s infrastructure (Supabase, Netlify).
        </p>
        <p className="mt-3">
          {advertising
            ? 'Unless you turn advertising off, the Meta Pixel reports public page views, vehicle views, started bookings and successfully submitted booking requests to Meta to measure and improve our Facebook and Instagram ads. Meta may receive browser and network information, page addresses and advertising identifiers, and may associate these with your Meta account under its own privacy policy. This is a "share" of personal information for cross-context behavioral advertising under California law, and you have the right to opt out of it below.'
            : 'Meta advertising measurement is not enabled on this host.'}
        </p>
        <p className="mt-3">
          Session recording is disabled. These tools never load on private confirmation, payment,
          identity-verification, or token-protected pages. Booking-access tokens, dates of birth, driver documents,
          card details and the values entered in driver forms are not included in our analytics events. A submitted
          booking request is not reported as a paid purchase. <strong>We do not sell personal information.</strong>
        </p>
      </section>

      <section>
        <h2>Your tracking choices</h2>
        <p>
          Use the controls below (also shown beside booking actions on every tracked page) to turn analytics and
          advertising off independently, at any time. Turning them off stops future collection in this browser
          immediately and deletes the identifiers these tools set; your choice is remembered and an opt-out never
          expires. If your browser sends a <strong>Global Privacy Control</strong> signal, advertising is turned off
          automatically and cannot be enabled. Neither setting is required to browse or book, and your service is the
          same either way. These settings are separate from any marketing e-mail you sign up for. To request deletion
          of data collected earlier, contact us using the details below. Learn more in{' '}
          <a href="https://posthog.com/privacy" rel="noreferrer" target="_blank">PostHog&apos;s privacy policy</a> and{' '}
          <a href="https://www.facebook.com/privacy/policy/" rel="noreferrer" target="_blank">Meta&apos;s privacy policy</a>.
        </p>
        <CookieControls manual className="mt-4 max-w-sm border-t border-[#2A2E3A]" />
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
            for it and confirmed it. Every message carries an unsubscribe link and one-click unsubscribe headers;
            unsubscribing stops all e-mail from us and turns off any alerts. E-mail is delivered by Resend; the daily
            availability check runs on Netlify. Unsubscribing does not delete your record: to have it deleted, write
            to <a href="mailto:hello@exotiq.ai">hello@exotiq.ai</a> from that address.
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
        <h2>Your rights</h2>
        <p>
          You can ask what we hold about you, and ask us to correct or delete it, by emailing{' '}
          <a href="mailto:hello@exotiq.ai">hello@exotiq.ai</a> from the address on the booking (that address is how we
          verify the request is yours). California residents may exercise the rights to know, correct, delete, and
          opt out of sharing this way or through the tracking controls above; we honor Global Privacy Control as an
          opt-out preference signal and never treat you differently for exercising any right. Operators keep their
          own records under their own policies — direct requests about a rental&apos;s records to your operator.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          When this notice changes, the date at the top changes with it. A material change to what we collect or who
          receives it will be flagged on this page before it takes effect.
        </p>
      </section>
    </LegalPage>
  );
}
