/** Calendar helpers for ISO local dates (YYYY-MM-DD). ISO strings compare lexicographically. */

export type MonthKey = { year: number; month: number };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthKeyFromIso(iso: string): MonthKey {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

export function daysInMonth({ year, month }: MonthKey): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday of the 1st of the month: 0 = Sunday … 6 = Saturday. */
export function firstWeekdayOfMonth({ year, month }: MonthKey): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthLabel({ year, month }: MonthKey): string {
  return `${MONTH_LONG[month - 1]} ${year}`;
}

export function addDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(iso: string): string {
  const { month } = monthKeyFromIso(iso);
  return `${MONTH_SHORT[month - 1]} ${Number(iso.slice(8, 10))}`;
}

/** "Jun 14 – Jun 17" or "Jun 28 – Jul 2"; omits the second month when it repeats: "Jun 14–17". */
export function formatRangeLabel(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return '';
  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7);
  if (sameMonth) return `${formatShortDate(startIso)}–${Number(endIso.slice(8, 10))}`;
  return `${formatShortDate(startIso)} – ${formatShortDate(endIso)}`;
}

/**
 * Instant → the team's LOCAL calendar date / clock time (T-3).
 *
 * Booking instants (start_at/end_at) are stored as the pickup moment composed
 * in the team's timezone; rendering them with `.slice(0, 10)` reads the UTC
 * date, which shifts afternoon/evening pickups to the wrong day for any
 * tenant east of UTC-0's slice boundary (audit-confirmed for a
 * America/New_York tenant). Always render through these.
 */
export function tzDate(instantIso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instantIso));
  } catch {
    return instantIso.slice(0, 10);
  }
}

export function tzTimeLabel(instantIso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(instantIso));
  } catch {
    return '';
  }
}
