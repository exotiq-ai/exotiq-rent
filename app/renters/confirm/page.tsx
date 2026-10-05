import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, displaySerifStyle, eyebrowClassName } from '@/components/browse/tokens';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { renterCaptureEnabled } from '@/domain/renters/config';
import { describeScope, pendingScopeForToken } from '@/domain/renters/capture';
import { CONSENT_TEXT } from '@/domain/renters/consentText';
import { looksLikeToken } from '@/domain/renters/tokens';

export const metadata: Metadata = { title: 'Confirm your e-mail | Drive Exotiq', robots: { index: false, follow: false } };

/** The page the confirmation link lands on (MP-14): one button, a plain form, no JavaScript needed. */
export default async function ConfirmPage({ searchParams }: { searchParams?: { token?: string } }) {
  if (!renterCaptureUiEnabled()) notFound();
  const token = searchParams?.token;
  const valid = looksLikeToken(token);
  // What this click grants, read from the pending link itself; an unknown token learns nothing.
  const scope = valid && renterCaptureEnabled() ? await pendingScopeForToken(token).catch(() => null) : null;
  const grants = scope ? describeScope(scope) : null;
  return (
    <BrowseChrome view={null} footerSignup={false}>
      <section className={`${containerClassName} max-w-2xl pb-24 pt-16 sm:pt-24`}>
        <p className={`${eyebrowClassName} text-faint`}>Drive Exotiq</p>
        <h1 className="mt-3 text-display leading-[1.05] text-ink sm:text-display-lg sm:leading-[1.05]" style={displaySerifStyle}>{valid ? 'One tap to confirm.' : 'That link is not right.'}</h1>
        <p className="mt-5 max-w-xl text-body leading-7 text-muted">{valid ? 'Confirm this e-mail address and we will send what you asked for.' : 'Open the link from the e-mail again, or ask from any car and we will send a fresh one.'}</p>
        {grants && (
          <p className="mt-3 max-w-xl text-body-sm leading-6 text-faint">This confirms: {grants.join('; ')}.</p>
        )}
        {valid && (
          <form method="post" action="/api/renters/confirm" className="mt-8">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="rounded-xl bg-gold px-6 py-3.5 text-body font-semibold text-goldInk transition hover:brightness-105">{scope?.has('consent') ? CONSENT_TEXT.confirm.button : 'Confirm my e-mail'}</button>
          </form>
        )}
      </section>
    </BrowseChrome>
  );
}
