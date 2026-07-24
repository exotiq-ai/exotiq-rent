// M6b: pure helpers for the renter payment window (M6-D4: 48h, clamped).
// Kept free of Date.now() so the UI and tests inject the clock.

export type PaymentWindowState = 'open' | 'urgent' | 'expired';

const URGENT_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export function paymentWindowState(dueAtIso: string, nowMs: number): PaymentWindowState {
  const due = Date.parse(dueAtIso);
  if (!Number.isFinite(due) || due <= nowMs) return 'expired';
  return due - nowMs <= URGENT_THRESHOLD_MS ? 'urgent' : 'open';
}

/** "41h 12m left" / "58m left" / "expired" — compact, for the pay card. */
export function paymentCountdownLabel(dueAtIso: string, nowMs: number): string {
  const due = Date.parse(dueAtIso);
  if (!Number.isFinite(due)) return '';
  const remaining = due - nowMs;
  if (remaining <= 0) return 'expired';
  const totalMinutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${Math.max(minutes, 1)}m left`;
  return `${hours}h ${minutes}m left`;
}
