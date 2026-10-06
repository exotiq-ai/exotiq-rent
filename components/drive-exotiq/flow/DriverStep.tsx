'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IdCard } from 'lucide-react';
import { microLabelClassName } from '@/components/browse/tokens';
import { caretAfterDigits, digitsBefore, displayFromIso, maskDob } from '@/domain/booking/dob';
import { attemptContinue, driverMissing, fieldMessages, missingSummary, withAgeBlock } from '@/domain/booking/driverValidation';
import { PrimaryButton } from '../BookingChrome';
import type { BookingCart, Driver } from '@/domain/booking/types';
import { ScreenShell, StepHeader, Sticky } from './shared';
import { stepEyebrow } from './steps';

function ageOn(dobIso: string, onIso: string): number {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  const on = new Date(`${onIso}T00:00:00Z`);
  if (Number.isNaN(dob.valueOf()) || Number.isNaN(on.valueOf())) return 0;
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = on.getUTCMonth() < dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

export function DriverStep({
  cart,
  setCart,
  next,
  announce,
}: {
  cart: BookingCart;
  setCart: (cart: BookingCart) => void;
  next: () => void;
  /** MP-18: writes one sentence into BookingFlow's always-mounted polite region (driver errata #2: the region lives outside this step). */
  announce?: (message: string) => void;
}) {
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
  // ID verification runs through Stripe Identity once the booking request
  // exists (the confirmation page offers it from then on); insurance is
  // handled with the operator before pickup, not collected here.
  // MP-18: an incomplete form explains itself. Continue stays tappable (aria-disabled), and an
  // attempt with gaps shows a line under each incomplete field, focuses the first and announces a
  // summary. The four rules are driverValidation's (unchanged); the age floor, which used to ride
  // on the disabled button, joins the blockers there. Nothing shows before the first attempt.
  const ageMessage = tooYoung ? `${cart.operator.name} requires drivers to be ${minAge}+ on the pickup date for this rental.` : null;
  const fieldGaps = driverMissing(cart.driver);
  const blockers = withAgeBlock(fieldGaps, ageMessage);
  const [attempted, setAttempted] = useState(false);
  const msgs = fieldMessages(fieldGaps, attempted);
  const dobMessage = dobError || msgs.dob || '';
  const nameInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const done = attempted && blockers.length === 0;
  // Once every gap is filled the summary has nothing left to say.
  useEffect(() => {
    if (done) announce?.('');
  }, [done, announce]);
  const onContinue = () =>
    attemptContinue(blockers, next, (missing) => {
      setAttempted(true);
      announce?.(missingSummary(fieldGaps, ageMessage));
      ({ name: nameInput, dob: dobInput, phone: phoneInput, email: emailInput })[missing[0].field].current?.focus();
    });

  // Placeholder was #3D4250 (~1.6:1 on the field): the four boxes read as empty. #848A9A clears 4.5:1 (MP-11).
  const fieldClass = 'mt-1 w-full rounded-lg border border-line bg-field px-3 py-2.5 text-body-lg text-ink outline-none transition placeholder:text-faint hover:border-line2 focus:border-gold/70 focus-visible:ring-2 focus-visible:ring-gold/60 aria-[invalid=true]:border-danger/70 [color-scheme:dark]';
  const label = `${microLabelClassName} text-faint`;

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow={stepEyebrow(2)} title="Who's driving?" sub="Takes about a minute." />
        <div className="rounded-xl border border-line bg-surface p-4">
          <label className="block">
            <span className={label}>Full name</span>
            <input ref={nameInput} type="text" value={cart.driver.name} onChange={(event) => setDriver({ name: event.target.value })} placeholder="Name as it appears on your license" autoComplete="name" aria-invalid={msgs.name ? true : undefined} aria-describedby={msgs.name ? 'driver-name-error' : undefined} className={fieldClass} />
          </label>
          {msgs.name && <p id="driver-name-error" className="mt-1.5 text-body-sm leading-5 text-danger">{msgs.name}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Date of birth</span>
              <input
                ref={dobInput}
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                placeholder="MM/DD/YYYY"
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
                aria-invalid={dobMessage ? true : undefined}
                aria-describedby="dob-hint dob-error"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={label}>Phone</span>
              <input ref={phoneInput} type="tel" value={cart.driver.phone} onChange={(event) => setDriver({ phone: event.target.value })} placeholder="555-555-0100" autoComplete="tel" aria-invalid={msgs.phone ? true : undefined} aria-describedby={msgs.phone ? 'driver-phone-error' : undefined} className={fieldClass} />
            </label>
            {msgs.phone && <p id="driver-phone-error" className="col-start-2 text-body-sm leading-5 text-danger">{msgs.phone}</p>}
          </div>
          <p id="dob-hint" className="sr-only">Type the digits of your date of birth: month, day, year.</p>
          {/* Always mounted and polite: a live region that appears already populated is skipped by VoiceOver, and an assertive alert mid-typing talks over the digit just pressed. */}
          <p id="dob-error" role="status" aria-live="polite" className={dobMessage ? 'mt-2 text-body-sm leading-5 text-danger' : 'sr-only'}>{dobMessage}</p>
          <label className="mt-3 block">
            <span className={label}>Email</span>
            <input ref={emailInput} type="email" value={cart.driver.email ?? ''} onChange={(event) => setDriver({ email: event.target.value })} placeholder="Where we send your confirmation" autoComplete="email" aria-invalid={msgs.email ? true : undefined} aria-describedby={msgs.email ? 'driver-email-error' : undefined} className={fieldClass} />
          </label>
          {msgs.email && <p id="driver-email-error" className="mt-1.5 text-body-sm leading-5 text-danger">{msgs.email}</p>}
        </div>
        {tooYoung && (
          <p className="mt-3 rounded-xl border border-danger/45 bg-danger/10 p-3 text-body-sm leading-5 text-ink">
            {cart.operator.name} requires drivers to be {minAge}+ on the pickup date for this rental.
          </p>
        )}
        {minAge == null && (
          <p className="mt-3 px-1 text-label leading-5 text-faint">
            Age and license requirements are set by {cart.operator.name} and confirmed before pickup.
          </p>
        )}
        <div className="mt-4 flex items-start gap-3 border-t border-line px-1 pt-4">
          <IdCard size={16} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <div className="text-body font-medium text-ink">ID check comes after booking</div>
            <p className="mt-1 text-body-sm leading-5 text-muted">You&apos;ll verify your identity right after you request the booking — takes about two minutes, have your license ready.</p>
          </div>
        </div>
      </ScreenShell>
      <Sticky><PrimaryButton onClick={onContinue} softDisabled={blockers.length > 0}>Continue</PrimaryButton></Sticky>
    </>
  );
}
