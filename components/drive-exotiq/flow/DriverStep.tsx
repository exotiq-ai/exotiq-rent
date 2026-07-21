'use client';

import { IdCard } from 'lucide-react';
import { PrimaryButton } from '../BookingChrome';
import type { BookingCart, Driver, VerificationStatus } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky, UploadCard } from './shared';

function ageOn(dobIso: string, onIso: string): number {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  const on = new Date(`${onIso}T00:00:00Z`);
  if (Number.isNaN(dob.valueOf()) || Number.isNaN(on.valueOf())) return 0;
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = on.getUTCMonth() < dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

export function DriverStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const setDriver = (patch: Partial<Driver>) => setCart({ ...cart, driver: { ...cart.driver, ...patch } });
  const setDoc = (kind: 'license' | 'insurance', status: VerificationStatus) => setDriver({ [kind]: { fileId: `mock-${kind}`, status, thumbnailUrl: '/images/app/app-detail.png' } });

  const minAge = cart.operator.policies?.minimumDriverAge ?? 25;
  const driverAge = cart.driver.dob ? ageOn(cart.driver.dob, cart.dates.start) : 0;
  const tooYoung = Boolean(cart.driver.dob) && driverAge < minAge;
  const fieldsComplete =
    cart.driver.name.trim().length > 1 &&
    Boolean(cart.driver.dob) &&
    cart.driver.phone.replace(/\D/g, '').length >= 10 &&
    (cart.driver.email ?? '').includes('@');
  // ID verification moved post-payment (ID plan V1 ruling) — only insurance
  // is collected here now (V5: separate path from Stripe Identity).
  const canContinue = fieldsComplete && !tooYoung && cart.driver.insurance.status === 'verified';

  const fieldClass = 'mt-1 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-sm text-[#F0F2F5] outline-none transition placeholder:text-[#3D4250] focus:border-[#C8A664]/60 [color-scheme:dark]';

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 03" title="Who's driving?" sub="We verify ahead of pickup · 60 seconds." />
        <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Full name</span>
            <input type="text" value={cart.driver.name} onChange={(event) => setDriver({ name: event.target.value })} placeholder="Name as it appears on your license" autoComplete="name" className={fieldClass} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Date of birth</span>
              <input type="date" value={cart.driver.dob} onChange={(event) => setDriver({ dob: event.target.value })} autoComplete="bday" className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Phone</span>
              <input type="tel" value={cart.driver.phone} onChange={(event) => setDriver({ phone: event.target.value })} placeholder="+1 (555) 555-0100" autoComplete="tel" className={fieldClass} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Email</span>
            <input type="email" value={cart.driver.email ?? ''} onChange={(event) => setDriver({ email: event.target.value })} placeholder="Where we send your confirmation" autoComplete="email" className={fieldClass} />
          </label>
        </div>
        {tooYoung && (
          <p className="mt-3 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-3 text-[12px] leading-5 text-[#F0F2F5]">
            {cart.operator.name} requires drivers to be {minAge}+ on the pickup date for this rental.
          </p>
        )}
        <div className="mt-5 px-1 text-[10px] uppercase tracking-[0.24em] text-[#5C6272]">Documents</div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><IdCard size={18} /></div>
          <div>
            <div className="text-sm font-medium text-[#F0F2F5]">ID check comes after booking</div>
            <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">You&apos;ll verify your identity right after payment — takes two minutes, have your license ready.</p>
          </div>
        </div>
        <UploadCard title="Proof of insurance" subtitle="Personal policy declaration page" status={cart.driver.insurance.status} tone="slate" onClick={() => setDoc('insurance', 'verified')} />
        <p className="mt-4 rounded-xl border border-dashed border-[#2A2E3A] bg-transparent p-3 text-[11.5px] leading-5 text-[#9BA1B0]">Exotiq never stores your ID — identity documents are processed securely by Stripe, our verification partner. Verified status lasts until your document expires.</p>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton></Sticky>
    </>
  );
}
