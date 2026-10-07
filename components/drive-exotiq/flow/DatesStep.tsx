'use client';

import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PrimaryButton } from '../BookingChrome';
import { countRentalDays, formatMoney } from '@/domain/booking/totals';
import type { BookingCart } from '@/domain/booking/types';
import { hasKnownAvailability, currentAvailabilityAuthority } from '@/domain/booking/types';
import { rangeIsBookable, localTodayIso } from '@/domain/booking/availability';
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
import { stepEyebrow } from './steps';
import { SETTLE_MS, SWALLOW_MS, type PageDir, type Sample, dragOffset, lockAxis, markInert, pageDecision, prefersReducedMotion, releaseVelocity, settleTransition, swallowsClick } from './monthPager';
import { eyebrowClassName, microLabelClassName } from '@/components/browse/tokens';

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

export function DatesStep({ cart, setCart, next, onRetryAvailability, availabilityPending = false }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void; onRetryAvailability?: () => void; availabilityPending?: boolean }) {
  // Calendar opens on the month of the selected start date (today by default)
  // and browses up to six months out.
  const [todayIso] = useState(todayIsoDate);
  const [visibleMonth, setVisibleMonth] = useState<MonthKey>(() => monthKeyFromIso(cart.dates.start));
  const minMonth = monthKeyFromIso(todayIso);
  const maxMonth = addMonths(minMonth, 6);
  const startIso = cart.dates.start;
  const endIso = cart.dates.end;

  const checked = hasKnownAvailability(cart.vehicle, startIso, endIso);
  const authority = currentAvailabilityAuthority(cart.vehicle.availabilityAuthority);
  const validCheckedWindow = authority.status === 'KNOWN' && hasKnownAvailability(cart.vehicle, authority.windowStart, authority.windowEnd);
  const isVerified = (iso: string) => validCheckedWindow && authority.status === 'KNOWN' && iso >= authority.windowStart && iso <= authority.windowEnd;
  const isBlocked = (iso: string) =>
    iso < todayIso || (isVerified(iso) && (cart.vehicle.unavailableRanges ?? []).some((range) => range.start <= iso && iso <= range.end));
  const hasBlockedDays = checked && (cart.vehicle.unavailableRanges ?? []).length > 0;

  const rangeCrossesBlocked = (fromIso: string, toIso: string) => {
    for (let iso = fromIso; iso <= toIso; iso = addDays(iso, 1)) if (isBlocked(iso)) return true;
    return false;
  };
  // Belt and braces for a seeded selection (MP-10): whatever wrote cart.dates,
  // Continue is only offered for a range the calendar itself would allow.
  const canContinue = !availabilityPending && rangeIsBookable(cart.vehicle, startIso, endIso, localTodayIso());

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

  // MP-25: the month pager. visibleMonth is the one reachable month; `neighbor` is the month sliding
  // in (mid-swipe or mid-slide), inert and out of the accessibility tree until it lands.
  const [neighbor, setNeighbor] = useState<{ month: MonthKey; dir: 1 | -1 } | null>(null);
  // The day just tapped: only its disc springs (never on paging, first render or other re-renders).
  const [springIso, setSpringIso] = useState<string | null>(null);
  const [washFrom, setWashFrom] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; axis: 'x' | 'y' | null; dx: number; samples: Sample[] } | null>(null);
  const settling = useRef(false);
  const settleId = useRef(0);
  const settleTarget = useRef<MonthKey | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  // The deadline a swipe's release arms for its own click (0 when none is pending).
  const swallowClick = useRef(0);

  const canGoPrev = compareMonthKeys(visibleMonth, minMonth) > 0;
  const canGoNext = compareMonthKeys(visibleMonth, maxMonth) < 0;

  const setTrack = (transform: string, transition: string) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = transform;
  };
  const commit = (to: MonthKey | null) => {
    settling.current = false;
    window.clearTimeout(settleTimer.current);
    flushSync(() => {
      if (to) {
        setVisibleMonth(to);
        setSpringIso(null);
      }
      setNeighbor(null);
    });
    setTrack('', 'none');
  };
  /** Slide to rest (dir 0 settles back) and commit; at once under reduced motion. Chevrons and swipes share it. */
  const settle = (dir: PageDir, to: MonthKey | null) => {
    const track = trackRef.current;
    const width = viewportRef.current?.clientWidth ?? 0;
    const target = dir === 0 ? null : to;
    if (!track || prefersReducedMotion() || width === 0) {
      commit(target);
      return;
    }
    settling.current = true;
    settleTarget.current = target;
    // Only this settle may land it: a later tap or swipe finishes it first and starts its own.
    const id = ++settleId.current;
    const finish = () => {
      if (settling.current && settleId.current === id) commit(target);
    };
    // The day buttons' colour changes end here too (the event bubbles): only the track's own slide lands the page.
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== track || e.propertyName !== 'transform') return;
      track.removeEventListener('transitionend', onEnd);
      finish();
    };
    track.addEventListener('transitionend', onEnd);
    settleTimer.current = window.setTimeout(finish, SETTLE_MS + 120);
    setTrack(`translateX(${-dir * width}px)`, settleTransition(false));
  };
  /** A tap or a touch during a slide lands it at once, so no tap is lost. */
  const finishSettle = (): MonthKey => {
    const shown = settleTarget.current ?? visibleMonth;
    commit(settleTarget.current);
    return shown;
  };
  const page = (dir: 1 | -1) => {
    if (drag.current) return;
    const from = settling.current ? finishSettle() : visibleMonth;
    const to = addMonths(from, dir);
    if (compareMonthKeys(to, minMonth) < 0 || compareMonthKeys(to, maxMonth) > 0) return;
    if (prefersReducedMotion()) {
      setVisibleMonth(to);
      setSpringIso(null);
      return;
    }
    flushSync(() => setNeighbor({ month: to, dir }));
    settle(dir, to);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swallowClick.current = 0;
    if (e.pointerType === 'mouse' || drag.current) return;
    if (settling.current) finishSettle();
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dx: 0, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (d.axis === null) {
      d.axis = lockAxis(dx, e.clientY - d.y0);
      if (d.axis === null) return;
      if (d.axis === 'y') {
        drag.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    d.dx = dx;
    d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    const dir = dx < 0 ? 1 : -1;
    if ((dir === 1 ? canGoNext : canGoPrev) && neighbor?.dir !== dir) setNeighbor({ month: addMonths(visibleMonth, dir), dir });
    const offset = dragOffset(dx, canGoPrev, canGoNext, viewportRef.current?.clientWidth ?? 0);
    setTrack(`translateX(${offset}px)`, 'none');
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.axis !== 'x') return;
    swallowClick.current = e.timeStamp + SWALLOW_MS;
    if (e.type === 'pointercancel') {
      settle(0, null);
      return;
    }
    const dir = pageDecision({ dx: d.dx, width: viewportRef.current?.clientWidth ?? 0, velocity: releaseVelocity(d.samples), canPrev: canGoPrev, canNext: canGoNext });
    settle(dir, dir === 0 ? null : addMonths(visibleMonth, dir));
  };
  // A swipe that started on a day selects nothing; a keyboard or assistive click right after one still selects.
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const deadline = swallowClick.current;
    swallowClick.current = 0;
    if (!swallowsClick(deadline, e)) return;
    e.stopPropagation();
    e.preventDefault();
  };
  const minEndIso = startIso ? addDays(startIso, cart.vehicle.minRentalDays) : '';
  const dateLabel = formatRangeLabel(startIso, endIso);
  // The closing tap: its end disc is the one just tapped and the range is no longer awaiting an end.
  const washIn = springIso !== null && springIso === endIso && !awaitingEnd;

  /** One month's day grid. Six week rows always (42 square cells), so paging never moves what sits below. */
  const renderMonth = (month: MonthKey) => {
    const totalDays = daysInMonth(month);
    const leadingBlanks = firstWeekdayOfMonth(month);
    return (
      <div data-calendar="month" className="grid grid-cols-7 px-0.5 text-center text-body">
        {Array.from({ length: leadingBlanks }).map((_, index) => <span key={`blank-${index}`} className="aspect-square" />)}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const iso = isoDate(month.year, month.month, day);
          const blocked = isBlocked(iso);
          const isStart = iso === startIso;
          const isEnd = iso === endIso;
          const inRange = !blocked && iso >= startIso && iso <= endIso;
          const isMinHint = iso === minEndIso && countRentalDays(startIso, iso) === cart.vehicle.minRentalDays;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                if (!blocked) {
                  setSpringIso(iso);
                  setWashFrom(endIso);
                }
                selectDay(iso);
              }}
              // Past days are disabled. With capture on, a taken future day is
              // a real control that offers an alert, and says so in its name;
              // with capture off it is disabled like before (MP-14).
              disabled={iso < todayIso || (blocked && !captureOn)}
              data-taken={blocked && iso >= todayIso ? '' : undefined}
              data-unverified={!isVerified(iso) && iso >= todayIso ? '' : undefined}
              // MP-11: hover fill and keyboard ring are drawn on the same 34px
              // disc the selected/today states use (a `before:` layer under
              // the number), so the grid never mixes two circle sizes.
              className="relative aspect-square text-muted outline-none transition-colors before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-[34px] before:w-[34px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full enabled:hover:text-ink enabled:hover:before:bg-surface focus-visible:before:ring-2 focus-visible:before:ring-gold/60 disabled:cursor-not-allowed disabled:text-dim data-[taken]:text-dim data-[taken]:hover:text-dim2 before:transition-transform before:duration-100 enabled:active:before:bg-surface active:before:scale-[0.96] motion-reduce:active:before:scale-100"
              aria-pressed={inRange}
              aria-label={`${longDate(iso)}${blocked ? (iso >= todayIso && captureOn ? ', taken — get an alert' : ', unavailable') : !isVerified(iso) ? ', availability not checked' : ''}`}
              aria-current={iso === todayIso ? 'date' : undefined}
            >
              {iso === todayIso && !inRange && !blocked && <span className="absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line2" aria-hidden />}
              {inRange && !isStart && !isEnd && <span className={`absolute inset-y-[5px] left-0 right-0 bg-gold/10${washIn && iso > (washFrom ?? '') ? ' animate-wash-in' : ''}`} />}
              {isStart && !isEnd && <span className={`absolute inset-y-[5px] left-1/2 right-0 bg-gold/10${washIn && iso > (washFrom ?? '') ? ' animate-wash-in' : ''}`} />}
              {isEnd && !isStart && <span className={`absolute inset-y-[5px] left-0 right-1/2 bg-gold/10${washIn && iso > (washFrom ?? '') ? ' animate-wash-in' : ''}`} />}
              {(isStart || isEnd) && <span className={`absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold${iso === springIso ? ' animate-day-spring' : ''}`} onAnimationEnd={() => setSpringIso(null)} />}
              {!inRange && !blocked && isMinHint && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-[15px] rounded-full bg-faint" />}
              <span className={`absolute inset-0 grid place-items-center tabular-nums${isStart || isEnd ? ' font-semibold text-goldInk' : inRange ? ' text-ink' : ''}${blocked ? ' line-through decoration-dim2' : ''}`}>{day}</span>
            </button>
          );
        })}
        {Array.from({ length: 42 - leadingBlanks - totalDays }).map((_, index) => <span key={`tail-${index}`} className="aspect-square" />)}
      </div>
    );
  };

  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow={stepEyebrow(1)} title="When are you driving?" sub={`${cart.vehicle.minRentalDays}-day minimum · from ${formatMoney(cart.vehicle.dailyRateCents)}/day`} />
        {(!checked || availabilityPending) && <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-line bg-surface p-4 text-body-sm">
          <p>{availabilityPending ? 'Checking availability…' : 'Availability has not been confirmed for these dates. Check before continuing.'}</p>
          {onRetryAvailability && <button type="button" className="mt-2 underline" disabled={availabilityPending} onClick={onRetryAvailability}>Check availability</button>}
        </div>}
        {checked && !availabilityPending && rangeCrossesBlocked(startIso, endIso) && <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-line bg-surface p-4 text-body-sm">
          <p>These dates are unavailable. Choose different dates or check again.</p>
          {onRetryAvailability && <button type="button" className="mt-2 underline" onClick={onRetryAvailability}>Check availability</button>}
        </div>}
        <div className="mt-4 flex items-center justify-between px-1">
          <button type="button" onClick={() => page(-1)} disabled={!canGoPrev} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-30 duration-100 active:scale-[0.96] motion-reduce:active:scale-100" aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span className="text-body font-medium tracking-[-0.005em]">{monthLabel(visibleMonth)}</span>
          <button type="button" onClick={() => page(1)} disabled={!canGoNext} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-30 duration-100 active:scale-[0.96] motion-reduce:active:scale-100" aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className={`mt-3 grid grid-cols-7 px-0.5 text-center ${microLabelClassName} text-faint`}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => <span key={`${d}-${index}`} className="py-1.5">{d}</span>)}
        </div>
        <div ref={viewportRef} data-calendar="viewport" className="relative overflow-hidden touch-pan-y" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onClickCapture}>
          <div ref={trackRef} className="relative">
            {renderMonth(visibleMonth)}
            {neighbor && (
              <div ref={markInert} aria-hidden="true" className={`absolute inset-y-0 w-full ${neighbor.dir === 1 ? 'left-full' : 'right-full'}`}>
                {renderMonth(neighbor.month)}
              </div>
            )}
          </div>
        </div>
        <div className={`mt-3 text-center ${microLabelClassName} text-faint`}>Tap start, then end · {cart.vehicle.minRentalDays}-day minimum{hasBlockedDays ? (captureOn ? ' · Crossed-out dates are taken — tap one for an alert' : ' · Crossed-out dates are unavailable') : ''}</div>
        {/* One sentence announces the card's arrival; the form below keeps its own status line (MP-14). */}
        <div aria-live="polite" className="sr-only">{alertWindow && captureOn ? `Alert offer for ${formatRangeLabel(alertWindow.start, alertWindow.end)} added below.` : ''}</div>
        <div>
          {alertWindow && captureOn && (
            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <div className="text-body font-medium text-ink">{formatRangeLabel(alertWindow.start, alertWindow.end)} is taken.</div>
              <p className="mt-1 text-body-sm leading-5 text-muted">Get one e-mail if this car opens up for those dates. We check every morning.</p>
              <EmailCaptureForm key={`${alertWindow.start}-${alertWindow.end}`} source="alert" cta="Alert me" compact teamSlug={cart.operator.slug} vehicleSlug={cart.vehicle.slug} alert={{ team_slug: cart.operator.slug, vehicle_slug: cart.vehicle.slug, start: alertWindow.start, end: alertWindow.end }} className="mt-3" />
            </div>
          )}
        </div>
        <label className={`mt-5 block ${eyebrowClassName} text-faint`}>Pickup time</label>
        {/* Still a native select (iOS wheel, screen-reader semantics), wearing
            the Driver step's field recipe with a muted chevron (MP-11; muted since MP-16). */}
        <span className="relative mt-2 block">
          <select value={cart.pickupTime} onChange={(event) => setCart(recomputeBookingCart({ ...cart, pickupTime: event.target.value }))} className="w-full appearance-none rounded-lg border border-line bg-field py-3 pl-4 pr-10 text-body-lg text-ink outline-none transition hover:border-line2 focus:border-gold/70 focus-visible:ring-2 focus-visible:ring-gold/60 [color-scheme:dark]" aria-label="Pickup time">
            {PICKUP_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        </span>
      </ScreenShell>
      <Sticky>
        <RunningTotalCard label={`${dateLabel} · ${cart.totals.days} ${cart.totals.days === 1 ? 'day' : 'days'}`} detail={`${formatMoney(cart.vehicle.dailyRateCents)}/day × ${cart.totals.days}`} amountCents={cart.totals.rentalSubtotalCents} />
        <PrimaryButton onClick={() => { if (!availabilityPending && rangeIsBookable(cart.vehicle, startIso, endIso, localTodayIso())) next(); }} disabled={!canContinue}>Continue</PrimaryButton>
      </Sticky>
    </>
  );
}
