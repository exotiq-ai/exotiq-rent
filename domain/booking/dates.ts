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
