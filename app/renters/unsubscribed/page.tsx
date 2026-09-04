import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, serifStyle } from '@/components/browse/tokens';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';

export const metadata: Metadata = { title: 'Unsubscribed | Drive Exotiq', robots: { index: false, follow: false } };

const COPY: Record<string, { title: string; body: string }> = {
  ok: { title: 'You are unsubscribed.', body: 'No more e-mail from Drive Exotiq, and any availability alerts are off. Booking confirmations still arrive when you rent a car.' },
  invalid: { title: 'That link did not work.', body: 'Use the unsubscribe link from the most recent e-mail, or write to hello@exotiq.ai and we will do it by hand.' },
  error: { title: 'Something went wrong.', body: 'Try the link again in a minute, or write to hello@exotiq.ai.' },
  unavailable: { title: 'Not available here.', body: 'This host does not run renter e-mail.' },
};

/** Landing page for the unsubscribe link (MP-14). */
export default function UnsubscribedPage({ searchParams }: { searchParams?: { state?: string } }) {
  if (!renterCaptureUiEnabled()) notFound();
  const state = searchParams?.state ?? 'invalid';
  const copy = Object.prototype.hasOwnProperty.call(COPY, state) ? COPY[state] : COPY.invalid;
  return (
    <BrowseChrome view={null} footerSignup={false}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#848A9A]">Drive Exotiq</p>
        <h1 className="mt-3 text-[36px] leading-[1.05] text-[#F0F2F5] sm:text-[48px]" style={{ ...serifStyle, letterSpacing: '-0.02em' }}>{copy.title}</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9BA1B0]">{copy.body}</p>
      </section>
    </BrowseChrome>
  );
}
