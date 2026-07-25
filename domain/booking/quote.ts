import { getDataMode } from './config';
import { adaptQuote } from './adapters';
import { fetchVehicleQuote } from './rpcClient';
import type { PublicQuote } from './publicContracts';
import type { BookingCart } from './types';

/**
 * Server-authoritative quoting for the renter flow.
 *
 * `public_vehicle_quote` is the money source of truth: the same RPC writes the
 * booking's fee snapshot at creation, and rent-checkout / rent-payment-webhook
 * charge from that snapshot without re-quoting. So rendering this quote makes
 * shown == booked == charged by construction.
 *
 * Why the client engine still exists (deliberate, not legacy):
 *  - `cart.totals.days` gates calendar navigation, so it cannot be deleted;
 *  - the step-02 running total is `dailyRateCents × days`, and both that rate
 *    and the server's `rental_subtotal_cents` derive from the SAME
 *    `vehicles.current_rate` column — it is a restatement of one server field,
 *    not an independently computed price;
 *  - mock mode (demo.exotiq.rent, /preview) has no backend to quote against.
 *
 * The quote therefore governs every point where the renter is asked to COMMIT
 * to a number (review, reserve) rather than every keystroke.
 */
export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; quote: PublicQuote }
  | { status: 'error'; key: string; message: string };

/**
 * Identity of a quotable selection. Pickup time is deliberately excluded — it
 * is not an input to the RPC, so including it would refetch for nothing.
 */
export function quoteKey(cart: BookingCart): string {
  return [cart.operator.slug, cart.vehicle.slug, cart.dates.start, cart.dates.end, cart.protection].join('|');
}

/**
 * A range is quotable only when the end is strictly after the start: the RPC
 * returns zero rows otherwise. The calendar can legitimately produce
 * start === end when it walks a provisional end backwards past blocked days,
 * so this must be checked rather than assumed.
 */
export function isQuotableRange(cart: BookingCart): boolean {
  return Boolean(cart.dates.start && cart.dates.end && cart.dates.end > cart.dates.start);
}

/** True when the flow should defer to the server for committed money figures. */
export function quotingEnabled(): boolean {
  return getDataMode() === 'supabase';
}

export class QuoteUnavailableError extends Error {}

/**
 * Fetch + adapt the server quote. Throws QuoteUnavailableError with
 * renter-safe copy — raw transport errors ("public_vehicle_quote failed (500)")
 * must never reach the UI.
 */
export async function loadQuote(cart: BookingCart): Promise<PublicQuote> {
  if (!isQuotableRange(cart)) {
    throw new QuoteUnavailableError('Choose your dates to see final pricing.');
  }
  let row;
  try {
    row = await fetchVehicleQuote(
      cart.operator.slug,
      cart.vehicle.slug,
      cart.dates.start,
      cart.dates.end,
      { protection: cart.protection },
    );
  } catch {
    throw new QuoteUnavailableError("We couldn't confirm final pricing. Check your connection and try again.");
  }
  if (!row) {
    throw new QuoteUnavailableError('Those dates are no longer available for this vehicle.');
  }
  return adaptQuote(row);
}
