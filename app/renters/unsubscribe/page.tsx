import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, displaySerifStyle, eyebrowClassName } from '@/components/browse/tokens';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';

export const metadata: Metadata = { title: 'Unsubscribe | Drive Exotiq', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,48}$/;

/** The page the unsubscribe link lands on (MP-14): the write happens only when the button is pressed. */
export default function UnsubscribePage({ searchParams }: { searchParams?: { r?: string; token?: string } }) {
  if (!renterCaptureUiEnabled()) notFound();
  const r = searchParams?.r ?? '';
  const token = searchParams?.token ?? '';
  const valid = UUID.test(r) && TOKEN.test(token);
  return (
    <BrowseChrome view={null} footerSignup={false}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className={`${eyebrowClassName} text-[#848A9A]`}>Drive Exotiq</p>
        <h1 className="mt-3 text-[36px] leading-[1.05] text-[#F0F2F5] sm:text-[48px]" style={displaySerifStyle}>{valid ? 'Unsubscribe?' : 'That link is not right.'}</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9BA1B0]">{valid ? 'This stops all e-mail from Drive Exotiq and turns off any availability alerts. Booking confirmations still arrive when you rent a car.' : 'Use the unsubscribe link from the most recent e-mail, or write to hello@exotiq.ai and we will do it by hand.'}</p>
        {valid && (
          <form method="post" action="/api/renters/unsubscribe" className="mt-8">
            <input type="hidden" name="r" value={r} />
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="rounded-xl border border-[#C8A664]/40 px-6 py-3.5 text-sm font-semibold text-[#C8A664] transition hover:bg-[#C8A664]/10">Unsubscribe</button>
          </form>
        )}
      </section>
    </BrowseChrome>
  );
}
