'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PrimaryButton } from '../BookingChrome';
import { countRentalDays, formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import {
  addDays,
  addMonths,
  compareMonthKeys,
  daysInMonth,
  firstWeekdayOfMonth,
  formatRangeLabel,
  isoDate,
  monthKeyFromIso,
  monthLabel,
  type MonthKey,
} from '@/domain/booking/dates';
import { RunningTotalCard, ScreenShell, StepHeader, Sticky } from './shared';
import { EmailCaptureForm } from '@/components/renters/EmailCaptureForm';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { MAX_WINDOW_DAYS, daysBetween } from '@/domain/booking/marketplaceQuery';
import { recomputeBookingCart } from './state';

// value is what the booking stores and what the backend casts into a
// timestamp (`<date> <value>`), so every value MUST be a parseable time.
// The after-hours option therefore submits a concrete evening time (the
// operator "reaches out before pickup" to confirm exact timing); it must
// never send free text like "Request after-hours pickup", which crashes the
// booking SQL with an invalid-timestamp cast. Backend hardening (regex
// validation of pickup_time + a real after-hours flag) is tracked in the
// Lovable handoff.
const PICKUP_TIMES: Array<{ value: string; label: string }> = [
  { value: '8:00 AM', label: '8:00 AM' },
  { value: '9:00 AM', label: '9:00 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '11:00 AM', label: '11:00 AM' },
  { value: '12:00 PM', label: '12:00 PM' },
  { value: '1:00 PM', label: '1:00 PM' },
  { value: '2:00 PM', label: '2:00 PM' },
  { value: '3:00 PM', label: '3:00 PM' },
  { value: '4:00 PM', label: '4:00 PM' },
  { value: '5:00 PM', label: '5:00 PM' },
  { value: '8:00 PM', label: 'After-hours pickup (8:00 PM+, operator confirms)' },
];

/** Full date for a day cell's accessible name — the bare digit told a screen reader nothing. */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function todayIsoDate(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function DatesStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  // Calendar opens on the month of the selected start date (today by default)
  // and browses up to six months out.
  const [todayIso] = useState(todayIsoDate);
  const [visibleMonth, setVisibleMonth] = useState<MonthKey>(() => monthKeyFromIso(cart.dates.start));
  const minMonth = monthKeyFromIso(todayIso);
  const maxMonth = addMonths(minMonth, 6);
  const startIso = cart.dates.start;
  const endIso = cart.dates.end;

  const isBlocked = (iso: string) =>
    iso < todayIso || (cart.vehicle.unavailableRanges ?? []).some((range) => range.start <= iso && iso <= range.end);
  const hasBlockedDays = (cart.vehicle.unavailableRanges ?? []).length > 0;

  const rangeCrossesBlocked = (fromIso: string, toIso: string) => {
    for (let iso = fromIso; iso <= toIso; iso = addDays(iso, 1)) if (isBlocked(iso)) return true;
    return false;
  };
  // Belt and braces for a seeded selection (MP-10): whatever wrote cart.dates,
  // Continue is only offered for a range the calendar itself would allow.
  const canContinue = cart.totals.days >= cart.vehicle.minRentalDays && !rangeCrossesBlocked(startIso, endIso);

  // Explicit two-tap selection. `awaitingEnd` tracks the phase directly rather
  // than inferring it from totals — the old inference (days >= min) meant the
  // second tap always reset instead of extending, capping every booking at the
  // minimum stay. First tap sets the start (with a minimum-length provisional
  // range so totals stay valid); second tap sets the end when it is after the
  // start, long enough, and crosses no blocked day; anything else restarts.
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const minDays = cart.vehicle.minRentalDays;

  const startNewRange = (iso: string) => {
    let end = addDays(iso, minDays);
    while (end > iso && rangeCrossesBlocked(iso, end)) end = addDays(end, -1);
    setCart(recomputeBookingCart({ ...cart, dates: { start: iso, end } }));
    setAwaitingEnd(true);
  };

  // MP-14: a taken day (not a past one) answers a tap with an alert offer.
  // The window is the range the renter was building when they hit it —
  // start already chosen and this day after it — else a minimum-stay
  // window from the tapped day.
  const captureOn = renterCaptureUiEnabled();
  const [alertWindow, setAlertWindow] = useState<{ start: string; end: string } | null>(null);
  const offerAlert = (start: string, end: string) => {
    if (!captureOn) return;
    if (daysBetween(todayIso, end) > MAX_WINDOW_DAYS) return;
    setAlertWindow({ start, end });
  };
  const selectDay = (iso: string) => {
    if (isBlocked(iso)) {
      if (iso >= todayIso) offerAlert(awaitingEnd && iso > startIso ? startIso : iso, awaitingEnd && iso > startIso ? iso : addDays(iso, minDays));
      return;
    }
    setAlertWindow(null);
    if (!awaitingEnd || iso <= startIso) {
      startNewRange(iso);
      return;
    }
    // Second tap, iso > startIso: extend if valid, else start over at iso —
    // but first offer an alert for the range that a taken day just broke.
    if (rangeCrossesBlocked(startIso, iso)) {
      offerAlert(startIso, iso);
      startNewRange(iso);
      return;
    }
    if (countRentalDays(startIso, iso) < minDays) {
      // Too short to satisfy the minimum — snap the end to the minimum stay.
      startNewRange(startIso);
      return;
    }
    setCart(recomputeBookingCart({ ...cart, dates: { start: startIso, end: iso } }));
    setAwaitingEnd(false);
  };

  const canGoPrev = compareMonthKeys(visibleMonth, minMonth) > 0;
  const canGoNext = compareMonthKeys(visibleMonth, maxMonth) < 0;
  const totalDays = daysInMonth(visibleMonth);
  const leadingBlanks = firstWeekdayOfMonth(visibleMonth);
  const minEndIso = startIso ? addDays(startIso, cart.vehicle.minRentalDays) : '';
  const dateLabel = formatRangeLabel(startIso, endIso);

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 02" title="When are you driving?" sub={`${cart.vehicle.minRentalDays}-day minimum · from ${formatMoney(cart.vehicle.dailyRateCents)}/day`} />
        <div className="mt-4 flex items-center justify-between px-1">
          <button type="button" onClick={() => canGoPrev && setVisibleMonth(addMonths(visibleMonth, -1))} disabled={!canGoPrev} className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5] disabled:opacity-30" aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span className="text-[15px] font-medium tracking-[-0.005em]">{monthLabel(visibleMonth)}</span>
          <button type="button" onClick={() => canGoNext && setVisibleMonth(addMonths(visibleMonth, 1))} disabled={!canGoNext} className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5] disabled:opacity-30" aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-3 grid grid-cols-7 px-0.5 text-center text-[10px] uppercase tracking-[0.16em] text-[#848A9A]">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => <span key={`${d}-${index}`} className="py-1.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 px-0.5 text-center text-sm">
          {Array.from({ length: leadingBlanks }).map((_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
            const iso = isoDate(visibleMonth.year, visibleMonth.month, day);
            const blocked = isBlocked(iso);
            const isStart = iso === startIso;
            const isEnd = iso === endIso;
            const inRange = !blocked && iso >= startIso && iso <= endIso;
            const isMinHint = iso === minEndIso && countRentalDays(startIso, iso) === cart.vehicle.minRentalDays;
            return (
              <button
                key={day}
                type="button"
                onClick={() => selectDay(iso)}
                // Past days are disabled. With capture on, a taken future day is
                // a real control that offers an alert, and says so in its name;
                // with capture off it is disabled like before (MP-14).
                disabled={iso < todayIso || (blocked && !captureOn)}
                data-taken={blocked && iso >= todayIso ? '' : undefined}
                // MP-11: hover fill and keyboard ring are drawn on the same 34px
                // disc the selected/today states use (a `before:` layer under
                // the number), so the grid never mixes two circle sizes.
                className="relative aspect-square text-[#9BA1B0] outline-none transition-colors before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-[34px] before:w-[34px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full enabled:hover:text-[#F0F2F5] enabled:hover:before:bg-[#161922] focus-visible:before:ring-2 focus-visible:before:ring-[#C8A664]/60 disabled:cursor-not-allowed disabled:text-[#3D4250] data-[taken]:text-[#3D4250] data-[taken]:hover:text-[#5C6272]"
                aria-pressed={inRange}
                aria-label={`${longDate(iso)}${blocked ? (iso >= todayIso && captureOn ? ', taken — get an alert' : ', unavailable') : ''}`}
                aria-current={iso === todayIso ? 'date' : undefined}
              >
                {iso === todayIso && !inRange && !blocked && <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#3A3F4D]" aria-hidden />}
                {inRange && !isStart && !isEnd && <span className="absolute inset-y-[5px] left-0 right-0 bg-[#C8A664]/10" />}
                {isStart && !isEnd && <span className="absolute inset-y-[5px] left-1/2 right-0 bg-[#C8A664]/10" />}
                {isEnd && !isStart && <span className="absolute inset-y-[5px] left-0 right-1/2 bg-[#C8A664]/10" />}
                {(isStart || isEnd) && <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8A664] shadow-[0_0_0_1px_#C8A664,0_0_14px_rgba(200,166,100,.30)]" />}
                {!inRange && !blocked && isMinHint && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-[15px] rounded-full bg-[#C8A664]/60" />}
                <span className={`absolute inset-0 grid place-items-center tabular-nums${isStart || isEnd ? ' font-semibold text-[#1A1308]' : inRange ? ' text-[#F0F2F5]' : ''}${blocked ? ' line-through decoration-[#5C6272]' : ''}`}>{day}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-[#848A9A]">Tap start, then end · {cart.vehicle.minRentalDays}-day minimum{hasBlockedDays ? (captureOn ? ' · Crossed-out dates are taken — tap one for an alert' : ' · Crossed-out dates are unavailable') : ''}</div>
        {/* Always mounted so the card's arrival is announced (MP-14). */}
        <div aria-live="polite">
          {alertWindow && captureOn && (
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <div className="text-sm font-medium text-[#F0F2F5]">{formatRangeLabel(alertWindow.start, alertWindow.end)} is taken.</div>
              <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">Get one e-mail if this car opens up for those dates. We check every morning.</p>
              <EmailCaptureForm key={`${alertWindow.start}-${alertWindow.end}`} source="alert" cta="Alert me" compact teamSlug={cart.operator.slug} vehicleSlug={cart.vehicle.slug} alert={{ team_slug: cart.operator.slug, vehicle_slug: cart.vehicle.slug, start: alertWindow.start, end: alertWindow.end }} className="mt-3" />
            </div>
          )}
        </div>
        <label className="mt-5 block text-xs uppercase tracking-[0.22em] text-[#848A9A]">Pickup time</label>
        {/* Still a native select (iOS wheel, screen-reader semantics), wearing
            the Driver step's field recipe with a gold chevron (MP-11). */}
        <span className="relative mt-2 block">
          <select value={cart.pickupTime} onChange={(event) => setCart(recomputeBookingCart({ ...cart, pickupTime: event.target.value }))} className="w-full appearance-none rounded-lg border border-[#2A2E3A] bg-[#10131A] py-3 pl-4 pr-10 text-sm text-[#F0F2F5] outline-none transition hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60 [color-scheme:dark]" aria-label="Pickup time">
            {PICKUP_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C8A664]" aria-hidden />
        </span>
      </ScreenShell>
      <Sticky>
        <RunningTotalCard label={`${dateLabel} · ${cart.totals.days} ${cart.totals.days === 1 ? 'day' : 'days'}`} detail={`${formatMoney(cart.vehicle.dailyRateCents)}/day × ${cart.totals.days}`} amountCents={cart.totals.rentalSubtotalCents} />
        <PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton>
      </Sticky>
    </>
  );
}
