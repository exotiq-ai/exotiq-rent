import { describe, expect, it } from 'vitest';
import { isQuotableRange, quoteKey } from './quote';
import { createInitialCart } from './mockData';
import type { BookingCart } from './types';

function cartWith(overrides: Partial<BookingCart>): BookingCart {
  return { ...createInitialCart(), ...overrides };
}

describe('quote key', () => {
  it('changes when a priced input changes', () => {
    const base = cartWith({ dates: { start: '2027-01-10', end: '2027-01-13' }, protection: 'premium' });
    const later = cartWith({ dates: { start: '2027-01-10', end: '2027-01-15' }, protection: 'premium' });
    const cheaper = cartWith({ dates: { start: '2027-01-10', end: '2027-01-13' }, protection: 'standard' });
    expect(quoteKey(base)).not.toBe(quoteKey(later));
    expect(quoteKey(base)).not.toBe(quoteKey(cheaper));
  });

  it('does NOT change for pickup time, which the quote RPC ignores', () => {
    // Refetching on pickup-time change would be a guaranteed-identical call.
    const a = cartWith({ pickupTime: '10:00 AM' });
    const b = cartWith({ pickupTime: '4:00 PM' });
    expect(quoteKey(a)).toBe(quoteKey(b));
  });

  it('is stable for an unchanged selection', () => {
    const a = cartWith({ dates: { start: '2027-03-01', end: '2027-03-04' } });
    const b = cartWith({ dates: { start: '2027-03-01', end: '2027-03-04' } });
    expect(quoteKey(a)).toBe(quoteKey(b));
  });
});

describe('quotable range guard', () => {
  it('accepts a normal forward range', () => {
    expect(isQuotableRange(cartWith({ dates: { start: '2027-01-10', end: '2027-01-13' } }))).toBe(true);
  });

  it('rejects start === end — the calendar can produce this by walking a provisional end back past blocked days, and public_vehicle_quote returns zero rows for it', () => {
    expect(isQuotableRange(cartWith({ dates: { start: '2027-01-10', end: '2027-01-10' } }))).toBe(false);
  });

  it('rejects an inverted range', () => {
    expect(isQuotableRange(cartWith({ dates: { start: '2027-01-13', end: '2027-01-10' } }))).toBe(false);
  });

  it('rejects an empty end (mid-selection)', () => {
    expect(isQuotableRange(cartWith({ dates: { start: '2027-01-10', end: '' } }))).toBe(false);
  });
});
