import { describe, expect, it } from 'vitest';
import { paymentCountdownLabel, paymentWindowState } from './payment';

const NOW = Date.parse('2026-07-23T12:00:00Z');

describe('payment window (M6-D4)', () => {
  it('reports open, urgent under 6h, and expired', () => {
    expect(paymentWindowState('2026-07-25T12:00:00Z', NOW)).toBe('open');
    expect(paymentWindowState('2026-07-23T17:00:00Z', NOW)).toBe('urgent');
    expect(paymentWindowState('2026-07-23T11:59:00Z', NOW)).toBe('expired');
    expect(paymentWindowState('not-a-date', NOW)).toBe('expired');
  });

  it('formats the countdown compactly', () => {
    expect(paymentCountdownLabel('2026-07-25T05:12:00Z', NOW)).toBe('41h 12m left');
    expect(paymentCountdownLabel('2026-07-23T12:58:30Z', NOW)).toBe('58m left');
    expect(paymentCountdownLabel('2026-07-23T11:00:00Z', NOW)).toBe('expired');
    // Never shows "0m left" while still payable.
    expect(paymentCountdownLabel('2026-07-23T12:00:30Z', NOW)).toBe('1m left');
  });
});
