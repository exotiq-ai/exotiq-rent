'use client';

import { PrimaryButton } from '../BookingChrome';
import type { BookingCart, VerificationStatus } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky, UploadCard, VerifiedPill } from './shared';

export function DriverStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const setDoc = (kind: 'license' | 'insurance', status: VerificationStatus) => setCart({ ...cart, driver: { ...cart.driver, [kind]: { fileId: `mock-${kind}`, status, thumbnailUrl: '/images/app/app-detail.png' } } });
  const canContinue = cart.driver.license.status === 'verified' && cart.driver.insurance.status === 'verified';
  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 03" title="Who's driving?" sub="We verify ahead of pickup · 60 seconds." />
        <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] px-4 py-1">
          {[
            ['Name', cart.driver.name],
            ['Date of birth', 'Jun 14, 1985 · 40'],
            ['Phone', '+1 (303) 555 · 0184'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center gap-3 border-b border-[#2A2E3A] py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">{label}</div>
                <div className="mt-1 text-sm text-[#F0F2F5]">{value}</div>
              </div>
              <VerifiedPill />
            </div>
          ))}
        </div>
        <div className="mt-5 px-1 text-[10px] uppercase tracking-[0.24em] text-[#5C6272]">Documents</div>
        <UploadCard title="Driver's license" subtitle="Front photo · expires after pickup" status={cart.driver.license.status} tone="gold" onClick={() => setDoc('license', 'verified')} />
        <UploadCard title="Proof of insurance" subtitle="Personal policy declaration page" status={cart.driver.insurance.status} tone="slate" onClick={() => setDoc('insurance', 'verified')} />
        <p className="mt-4 rounded-xl border border-dashed border-[#2A2E3A] bg-transparent p-3 text-[11.5px] leading-5 text-[#9BA1B0]">We verify ahead of pickup so you skip the counter. Documents are encrypted and deleted within 30 days of return.</p>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton></Sticky>
    </>
  );
}
