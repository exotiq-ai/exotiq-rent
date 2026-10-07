import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, displaySerifStyle, eyebrowClassName } from '@/components/browse/tokens';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';

export const metadata: Metadata = { title: 'Unsubscribed | Drive Exotiq', robots: { index: false, follow: false } };

const COPY: Record<string, { title: string; body: string }> = {
  ok: { title: 'You are unsubscribed.', body: 'No more e-mail from Drive Exotiq, and any availability alerts are off. Booking confirmations still arrive when you rent a car.' },
  invalid: { title: 'That link did not work.', body: 'Use the unsubscribe link from the most recent e-mail, or write to hello@exotiq.ai and we will do it by hand.' },
  error: { title: 'Something went wrong.', body: 'Try the link again in a minute, or write to hello@exotiq.ai.' },
  unavailable: { title: 'Not available here.', body: 'This host does not run renter e-mail.' },
};

/** Landing page for the unsubscribe link (MP-14). */
export default async function UnsubscribedPage({ searchParams: pendingSearch }: { searchParams?: Promise<{ state?: string }> }) {
  const searchParams = await pendingSearch;
  if (!renterCaptureUiEnabled()) notFound();
  const state = searchParams?.state ?? 'invalid';
  const copy = Object.prototype.hasOwnProperty.call(COPY, state) ? COPY[state] : COPY.invalid;
  return (
    <BrowseChrome view={null} footerSignup={false}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className={`${eyebrowClassName} text-faint`}>Drive Exotiq</p>
        <h1 className="mt-3 text-display leading-[1.05] text-ink sm:text-display-lg sm:leading-[1.05]" style={displaySerifStyle}>{copy.title}</h1>
        <p className="mt-5 max-w-xl text-body leading-7 text-muted">{copy.body}</p>
      </section>
    </BrowseChrome>
  );
}
