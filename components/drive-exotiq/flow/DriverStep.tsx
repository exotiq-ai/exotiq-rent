'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { IdCard } from 'lucide-react';
import { microLabelClassName } from '@/components/browse/tokens';
import { caretAfterDigits, digitsBefore, displayFromIso, maskDob } from '@/domain/booking/dob';
import { PrimaryButton } from '../BookingChrome';
import type { BookingCart, Driver } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky } from './shared';

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
  // Date of birth as a masked field (MP-12): a native picker opens on the
  // current month and needs thirty years of back-navigation. The mask keeps
  // the caret beside the digit that was edited, and an impossible or future
  // date says so under the field instead of silently disabling Continue.
  const [dobText, setDobText] = useState(() => displayFromIso(cart.driver.dob));
  const [dobError, setDobError] = useState('');
  // Bumped on every change, so the caret is re-placed even when the mask swallowed the keystroke and the display is unchanged.
  const [dobEdit, setDobEdit] = useState(0);
  const dobInput = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !dobInput.current) return;
    const at = caretAfterDigits(dobText, pendingCaret.current);
    dobInput.current.setSelectionRange(at, at);
    pendingCaret.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dobEdit]);
  const dobDigits = dobText.replace(/\D/g, '').length;

  // Only enforce an age floor the operator actually set. Live (supabase-mode)
  // operators carry no policies today, and the old `?? 25` fallback fabricated
  // a "{operator} requires 25+" rule in their name and hard-blocked younger
  // renters they might happily serve (T-5).
  const minAge = cart.operator.policies?.minimumDriverAge;
  const driverAge = cart.driver.dob ? ageOn(cart.driver.dob, cart.dates.start) : 0;
  const tooYoung = minAge != null && Boolean(cart.driver.dob) && driverAge < minAge;
  const fieldsComplete =
    cart.driver.name.trim().length > 1 &&
    Boolean(cart.driver.dob) &&
    cart.driver.phone.replace(/\D/g, '').length >= 10 &&
    (cart.driver.email ?? '').includes('@');
  // ID verification is post-payment via Stripe Identity (ID plan V1 ruling);
  // insurance is handled with the operator before pickup, not collected here.
  const canContinue = fieldsComplete && !tooYoung;

  // Placeholder was #3D4250 (~1.6:1 on the field): the four boxes read as empty. #848A9A clears 4.5:1 (MP-11).
  const fieldClass = 'mt-1 w-full rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 py-2.5 text-sm text-[#F0F2F5] outline-none transition placeholder:text-[#848A9A] hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 aria-[invalid=true]:border-[#FFB84D]/70 [color-scheme:dark]';
  const label = `${microLabelClassName} text-[#848A9A]`;

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 03" title="Who's driving?" sub="Takes about a minute." />
        <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <label className="block">
            <span className={label}>Full name</span>
            <input type="text" value={cart.driver.name} onChange={(event) => setDriver({ name: event.target.value })} placeholder="Name as it appears on your license" autoComplete="name" className={fieldClass} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Date of birth</span>
              <input
                ref={dobInput}
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                placeholder="MM / DD / YYYY"
                value={dobText}
                onChange={(event) => {
                  const raw = event.target.value;
                  pendingCaret.current = digitsBefore(raw, event.target.selectionStart ?? raw.length);
                  const { display, iso, error } = maskDob(raw);
                  setDobText(display);
                  setDobError(error);
                  setDobEdit((n) => n + 1);
                  setDriver({ dob: iso });
                }}
                onBlur={() => {
                  if (dobDigits > 0 && dobDigits < 8) setDobError('Finish the date as MM / DD / YYYY.');
                }}
                aria-invalid={dobError ? true : undefined}
                aria-describedby="dob-hint dob-error"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={label}>Phone</span>
              <input type="tel" value={cart.driver.phone} onChange={(event) => setDriver({ phone: event.target.value })} placeholder="+1 (555) 555-0100" autoComplete="tel" className={fieldClass} />
            </label>
          </div>
          <p id="dob-hint" className="sr-only">Type the digits of your date of birth: month, day, year.</p>
          {/* Always mounted and polite: a live region that appears already populated is skipped by VoiceOver, and an assertive alert mid-typing talks over the digit just pressed. */}
          <p id="dob-error" role="status" aria-live="polite" className={dobError ? 'mt-2 text-[12px] leading-5 text-[#FFB84D]' : 'sr-only'}>{dobError}</p>
          <label className="mt-3 block">
            <span className={label}>Email</span>
            <input type="email" value={cart.driver.email ?? ''} onChange={(event) => setDriver({ email: event.target.value })} placeholder="Where we send your confirmation" autoComplete="email" className={fieldClass} />
          </label>
        </div>
        {tooYoung && (
          <p className="mt-3 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-3 text-[12px] leading-5 text-[#F0F2F5]">
            {cart.operator.name} requires drivers to be {minAge}+ on the pickup date for this rental.
          </p>
        )}
        {minAge == null && (
          <p className="mt-3 px-1 text-[11px] leading-5 text-[#848A9A]">
            Age and license requirements are set by {cart.operator.name} and confirmed before pickup.
          </p>
        )}
        <div className={`mt-4 px-1 ${label}`}>Verification</div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><IdCard size={16} /></div>
          <div>
            <div className="text-sm font-medium text-[#F0F2F5]">ID check comes after booking</div>
            <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">You&apos;ll verify your identity right after payment — takes two minutes, have your license ready.</p>
          </div>
        </div>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton></Sticky>
    </>
  );
}
