import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysInMonth, firstWeekdayOfMonth, formatRangeLabel, isoDate, monthKeyFromIso } from './dates';

describe('calendar date helpers', () => {
  it('builds and parses ISO dates', () => {
    expect(isoDate(2026, 7, 4)).toBe('2026-07-04');
    expect(monthKeyFromIso('2026-06-14')).toEqual({ year: 2026, month: 6 });
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth({ year: 2026, month: 6 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 7 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
  });

  it('aligns the first weekday for calendar layout (June 2026 starts on Monday)', () => {
    expect(firstWeekdayOfMonth({ year: 2026, month: 6 })).toBe(1);
  });

  it('navigates months across year boundaries', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('formats range labels within and across months', () => {
    expect(formatRangeLabel('2026-06-14', '2026-06-17')).toBe('Jun 14–17');
    expect(formatRangeLabel('2026-06-28', '2026-07-02')).toBe('Jun 28 – Jul 2');
  });
});
