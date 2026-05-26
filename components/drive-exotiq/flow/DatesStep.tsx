'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PrimaryButton } from '../BookingChrome';
import { countRentalDays, formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { RunningTotalCard, ScreenShell, StepHeader, Sticky } from './shared';
import { recomputeBookingCart } from './state';

const dateForDay = (day: number) => `2026-06-${String(day).padStart(2, '0')}`;
const dayFromDate = (date: string) => Number(date.split('-')[2] ?? 0);

export function DatesStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const startDay = dayFromDate(cart.dates.start);
  const endDay = dayFromDate(cart.dates.end);
  const minEndDay = Math.min(30, startDay + cart.vehicle.minRentalDays);
  const canContinue = cart.totals.days >= cart.vehicle.minRentalDays;

  const selectDay = (day: number) => {
    if (!startDay || day <= startDay || cart.totals.days >= cart.vehicle.minRentalDays) {
      setCart(recomputeBookingCart({ ...cart, dates: { start: dateForDay(day), end: dateForDay(Math.min(30, day + cart.vehicle.minRentalDays)) } }));
      return;
    }
    setCart(recomputeBookingCart({ ...cart, dates: { ...cart.dates, end: dateForDay(day) } }));
  };

  const dateLabel = `Jun ${startDay} – ${endDay}`;

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 02" title="When are you driving?" sub={`${cart.vehicle.minRentalDays}-day minimum · from ${formatMoney(cart.vehicle.dailyRateCents)}/day`} />
        <div className="mt-4 flex items-center justify-between px-1">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0]" aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span className="text-[15px] font-medium tracking-[-0.005em]">June 2026</span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0]" aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-3 grid grid-cols-7 px-0.5 text-center text-[10px] uppercase tracking-[0.16em] text-[#5C6272]">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => <span key={`${d}-${index}`} className="py-1.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 px-0.5 text-center text-sm">
          <span />
          {days.map((day) => {
            const isStart = day === startDay;
            const isEnd = day === endDay;
            const inRange = day >= startDay && day <= endDay;
            const isMinHint = day === minEndDay && countRentalDays(dateForDay(startDay), dateForDay(day)) === cart.vehicle.minRentalDays;
            return (
              <button key={day} type="button" onClick={() => selectDay(day)} className="relative aspect-square" aria-pressed={inRange}>
                {inRange && !isStart && !isEnd && <span className="absolute inset-y-[5px] left-0 right-0 bg-[#C8A664]/10" />}
                {isStart && <span className="absolute inset-y-[5px] left-1/2 right-0 bg-[#C8A664]/10" />}
                {isEnd && <span className="absolute inset-y-[5px] left-0 right-1/2 bg-[#C8A664]/10" />}
                {(isStart || isEnd) && <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8A664] shadow-[0_0_0_1px_#C8A664,0_0_14px_rgba(200,166,100,.30)]" />}
                {!inRange && isMinHint && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-[15px] rounded-full bg-[#C8A664]/60" />}
                <span className="absolute inset-0 grid place-items-center tabular-nums" style={{ color: isStart || isEnd ? '#1A1308' : inRange ? '#F0F2F5' : '#9BA1B0', fontWeight: isStart || isEnd ? 600 : 400 }}>{day}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-[#5C6272]">Tap start, then end · {cart.vehicle.minRentalDays}-day minimum</div>
        <label className="mt-5 block text-xs uppercase tracking-[0.22em] text-[#5C6272]">Pickup time</label>
        <select value={cart.pickupTime} onChange={(event) => setCart(recomputeBookingCart({ ...cart, pickupTime: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2A2E3A] bg-[#161922] px-4 py-3 text-sm text-[#F0F2F5]">
          <option>10:00 AM</option><option>12:00 PM</option><option>2:00 PM</option><option>4:00 PM</option>
        </select>
      </ScreenShell>
      <Sticky>
        <RunningTotalCard label={`${dateLabel} · ${cart.totals.days} days`} detail={`${formatMoney(cart.vehicle.dailyRateCents)}/day × ${cart.totals.days}`} amountCents={cart.totals.rentalSubtotalCents} />
        <PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton>
      </Sticky>
    </>
  );
}
