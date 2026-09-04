import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, serifStyle } from '@/components/browse/tokens';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { looksLikeToken } from '@/domain/renters/tokens';

export const metadata: Metadata = { title: 'Confirm your e-mail | Drive Exotiq', robots: { index: false, follow: false } };

/** The page the confirmation link lands on (MP-14): one button, a plain form, no JavaScript needed. */
export default function ConfirmPage({ searchParams }: { searchParams?: { token?: string } }) {
  if (!renterCaptureUiEnabled()) notFound();
  const token = searchParams?.token;
  const valid = looksLikeToken(token);
  return (
    <BrowseChrome view={null}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#848A9A]">Drive Exotiq</p>
        <h1 className="mt-3 text-[36px] leading-[1.05] text-[#F0F2F5] sm:text-[48px]" style={{ ...serifStyle, letterSpacing: '-0.02em' }}>{valid ? 'One tap to confirm.' : 'That link is not right.'}</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9BA1B0]">{valid ? 'Confirm this e-mail address and we will send what you asked for.' : 'Open the link from the e-mail again, or ask from any car and we will send a fresh one.'}</p>
        {valid && (
          <form method="post" action="/api/renters/confirm" className="mt-8">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308] transition hover:brightness-105">Confirm my e-mail</button>
          </form>
        )}
      </section>
    </BrowseChrome>
  );
}
