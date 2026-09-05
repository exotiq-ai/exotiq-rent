import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, displaySerifStyle, eyebrowClassName } from '@/components/browse/tokens';
import { browseEnabled } from '@/domain/booking/config';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';

export const metadata: Metadata = { title: 'Confirmed | Drive Exotiq', robots: { index: false, follow: false } };

const COPY: Record<string, { title: string; body: string }> = {
  ok: { title: 'Your e-mail is confirmed.', body: 'Thank you.' },
  marketing: { title: 'You are on the list.', body: 'Your e-mail is confirmed, and first looks at new cars are on.' },
  invalid: { title: 'That link has expired.', body: 'Confirmation links work once. Ask again from any car and we will send a fresh one.' },
  error: { title: 'Something went wrong.', body: 'We could not confirm your e-mail just now. Try the link again in a minute.' },
  unavailable: { title: 'Not available here.', body: 'This host does not run renter e-mail.' },
};

/** Landing page for the confirmation link (MP-14). */
export default function ConfirmedPage({ searchParams }: { searchParams?: { state?: string; sent?: string; marketing?: string; alerts?: string } }) {
  if (!renterCaptureUiEnabled()) notFound();
  // Only the route's own redirect says ok; a typed or stripped URL reads as invalid.
  const raw = searchParams?.state ?? 'invalid';
  const state = raw === 'ok' && searchParams?.marketing === '1' ? 'marketing' : raw;
  const copy = Object.prototype.hasOwnProperty.call(COPY, state) ? COPY[state] : COPY.invalid;
  const sentList = raw === 'ok' && searchParams?.sent === 'saved_list';
  return (
    <BrowseChrome view={null} footerSignup={false}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className={`${eyebrowClassName} text-[#848A9A]`}>Drive Exotiq</p>
        <h1 className="mt-3 text-[36px] leading-[1.05] text-[#F0F2F5] sm:text-[48px]" style={displaySerifStyle}>{copy.title}</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9BA1B0]">{copy.body}{sentList ? ' Your saved cars are on their way to your inbox.' : ''}{raw === 'ok' && searchParams?.alerts === '1' ? ' Your availability alert is on: we check every morning and e-mail you once when the dates open up.' : ''}</p>
        {browseEnabled() && <Link href="/browse" className="mt-8 inline-block rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">Browse the fleet</Link>}
      </section>
    </BrowseChrome>
  );
}
