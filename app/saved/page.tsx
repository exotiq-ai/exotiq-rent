import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName, displaySerifStyle, eyebrowClassName } from '@/components/browse/tokens';
import { SavedList } from '@/components/renters/SavedList';
import { browseEnabled } from '@/domain/booking/config';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';

export const metadata: Metadata = { title: 'Saved cars | Drive Exotiq', robots: { index: false, follow: false } };

/** /saved (MP-14): only where the heart exists (capture on) and the fleet is browsable. */
export default function SavedPage() {
  if (!renterCaptureUiEnabled() || !browseEnabled()) notFound();
  return (
    <BrowseChrome view={null}>
      <section className={`${containerClassName} pb-16 pt-12 sm:pt-16`}>
        <p className={`${eyebrowClassName} text-[#848A9A]`}>Drive Exotiq</p>
        <h1 className="mt-3 text-[40px] leading-[1.02] text-[#F0F2F5] sm:text-[56px]" style={displaySerifStyle}>Saved cars.</h1>
        <div className="mt-10"><SavedList /></div>
      </section>
    </BrowseChrome>
  );
}
