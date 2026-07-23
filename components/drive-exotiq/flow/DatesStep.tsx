'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { recomputeBookingCart } from './state';

const PICKUP_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', 'Request after-hours pickup'];

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
  const canContinue = cart.totals.days >= cart.vehicle.minRentalDays;

  const isBlocked = (iso: string) =>
    iso < todayIso || (cart.vehicle.unavailableRanges ?? []).some((range) => range.start <= iso && iso <= range.end);
  const hasBlockedDays = (cart.vehicle.unavailableRanges ?? []).length > 0;

  const rangeCrossesBlocked = (fromIso: string, toIso: string) => {
    for (let iso = fromIso; iso <= toIso; iso = addDays(iso, 1)) if (isBlocked(iso)) return true;
    return false;
  };

  const selectDay = (iso: string) => {
    if (isBlocked(iso)) return;
    if (!startIso || iso <= startIso || cart.totals.days >= cart.vehicle.minRentalDays) {
      let end = addDays(iso, cart.vehicle.minRentalDays);
      // Pull the default end back so the range never spans an unavailable day.
      while (end > iso && rangeCrossesBlocked(iso, end)) end = addDays(end, -1);
      setCart(recomputeBookingCart({ ...cart, dates: { start: iso, end } }));
      return;
    }
    if (rangeCrossesBlocked(startIso, iso)) return;
    setCart(recomputeBookingCart({ ...cart, dates: { ...cart.dates, end: iso } }));
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
        <div className="mt-3 grid grid-cols-7 px-0.5 text-center text-[10px] uppercase tracking-[0.16em] text-[#5C6272]">
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
              <button key={day} type="button" onClick={() => selectDay(iso)} disabled={blocked} className={`relative aspect-square${blocked ? ' cursor-not-allowed' : ''}`} aria-pressed={inRange} aria-disabled={blocked}>
                {inRange && !isStart && !isEnd && <span className="absolute inset-y-[5px] left-0 right-0 bg-[#C8A664]/10" />}
                {isStart && !isEnd && <span className="absolute inset-y-[5px] left-1/2 right-0 bg-[#C8A664]/10" />}
                {isEnd && !isStart && <span className="absolute inset-y-[5px] left-0 right-1/2 bg-[#C8A664]/10" />}
                {(isStart || isEnd) && <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8A664] shadow-[0_0_0_1px_#C8A664,0_0_14px_rgba(200,166,100,.30)]" />}
                {!inRange && !blocked && isMinHint && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-[15px] rounded-full bg-[#C8A664]/60" />}
                <span className={`absolute inset-0 grid place-items-center tabular-nums${blocked ? ' line-through decoration-[#5C6272]' : ''}`} style={{ color: isStart || isEnd ? '#1A1308' : inRange ? '#F0F2F5' : blocked ? '#3D4250' : '#9BA1B0', fontWeight: isStart || isEnd ? 600 : 400 }}>{day}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Tap start, then end · {cart.vehicle.minRentalDays}-day minimum{hasBlockedDays ? ' · Crossed-out dates are unavailable' : ''}</div>
        <label className="mt-5 block text-xs uppercase tracking-[0.22em] text-[#5C6272]">Pickup time</label>
        <select value={cart.pickupTime} onChange={(event) => setCart(recomputeBookingCart({ ...cart, pickupTime: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2A2E3A] bg-[#161922] px-4 py-3 text-sm text-[#F0F2F5]">
          {PICKUP_TIMES.map((time) => <option key={time}>{time}</option>)}
        </select>
      </ScreenShell>
      <Sticky>
        <RunningTotalCard label={`${dateLabel} · ${cart.totals.days} days`} detail={`${formatMoney(cart.vehicle.dailyRateCents)}/day × ${cart.totals.days}`} amountCents={cart.totals.rentalSubtotalCents} />
        <PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton>
      </Sticky>
    </>
  );
}
