import { addDays } from './dates';
import { countRentalDays } from './totals';
import type { UnavailableDateRange } from './types';

/**
 * The one day-granular bookability rule (MP-10). A range [start, end]
 * (pickup day .. drop-off day) is bookable when it starts today or later,
 * is at least one day long and at least the car's minimum stay, and no day
 * of it — the drop-off day included — is blocked. Inclusive on purpose: it
 * is the rule the booking calendar has always applied, and the grid's busy
 * read is asked for the same inclusive window so "available for your dates"
 * never lists a car the calendar would then refuse.
 */
export function rangeIsBookable(
  vehicle: { minRentalDays: number; unavailableRanges?: UnavailableDateRange[] },
  start: string,
  end: string,
  todayIso: string,
): boolean {
  if (start < todayIso || end <= start) return false;
  if (countRentalDays(start, end) < vehicle.minRentalDays) return false;
  const blocked = vehicle.unavailableRanges ?? [];
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
    if (blocked.some((r) => r.start <= iso && iso <= r.end)) return false;
  }
  return true;
}

/** Local calendar date (the renter's device), for client-side date guards. */
export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
