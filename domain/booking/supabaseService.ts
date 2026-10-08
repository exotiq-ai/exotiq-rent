import { adaptBusyRanges, adaptFleetVehicle, adaptTeam, adaptVehicleDetail } from './adapters';
import {
  fetchBookingByRef,
  fetchPublicTeam,
  fetchPublicTeamFleet,
  fetchPublicVehicle,
  fetchSignedVehicleMedia,
  fetchVehicleAvailability,
  postCreateBooking,
  type RpcBookingByRefRow,
} from './rpcClient';
import type { AvailabilityAuthority, AvailabilityWindow, BookingCart } from './types';
import { hasKnownAvailability, validAvailabilityDate } from './types';
import { addDays } from './dates';
import { rangeIsBookable } from './availability';
import { protectionForRequest } from './protect';
import type { BookingLookupResult, CreateBookingResult, PublicTeamStorefront, PublicVehicleContext } from './publicContracts';

/**
 * Minimal, safe context from the token-authorized booking row, for when the
 * catalog fetch fails (vehicle unlisted / in maintenance / tenant hidden after
 * booking). Carries the identifiers and names the confirmation needs to render
 * and keep Pay/Cancel working; visual extras (hero image, specs, exact pickup
 * address) are absent by necessity and the UI degrades gracefully. In the live
 * confirmation path all money comes from the row's `live.*` fields, never from
 * these placeholder totals.
 */
function synthesizeContextFromRow(row: RpcBookingByRefRow): PublicVehicleContext {
  const teamSlug = row.team_slug ?? '';
  const vehicleSlug = row.vehicle_slug ?? '';
  const vehicleName = row.vehicle_name ?? 'Your vehicle';
  const availabilityAuthority: AvailabilityAuthority = { status: 'UNKNOWN', reason: 'not_checked', retryAfterSeconds: 30 };
  return {
    availabilityAuthority,
    team: {
      id: '', slug: teamSlug, name: row.team_name ?? 'Your operator',
      city: '', state: '',
      // The by_ref row now carries contact + pickup (T-15), so even the
      // degraded catalog-outage path keeps the renter's contact affordances.
      phone: row.support_phone ?? '',
      supportEmail: row.support_email ?? undefined,
      pickupAddress: row.pickup_address ?? undefined,
      pickupInstructions: row.pickup_instructions ?? undefined,
    },
    vehicle: {
      id: '', slug: vehicleSlug, operatorId: '', name: vehicleName,
      shortName: vehicleName, year: 0, make: vehicleName.split(' ')[0] ?? '', model: '',
      dailyRateCents: 0, minRentalDays: 1, securityDepositCents: 0,
      photos: [], heroImage: '', footnote: '',
      pickupLocation: { name: '', address: '', city: '', state: '' },
      availabilityAuthority,
    },
  };
}

/**
 * Supabase-mode reads (M4): real storefronts from the five public RPCs.
 * Server-side visibility gating (marketplace_visible, demo exclusion) is
 * enforced inside the RPCs — a null here is a true 404.
 */

const AVAILABILITY_WINDOW_DAYS = 180;

function availabilityWindow(timezone = 'UTC'): AvailabilityWindow {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(({type,value})=>[type,value]));
  const start = `${fields.year}-${fields.month}-${fields.day}`;
  return { start, end: addDays(start, AVAILABILITY_WINDOW_DAYS) };
}

async function bounded<T>(read: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Read timed out'));},5000);})]);
  } finally { if(timer !== undefined) clearTimeout(timer); }
}

async function checkedAvailability(teamSlug: string, vehicleSlug: string, window: AvailabilityWindow): Promise<{ authority: AvailabilityAuthority; ranges?: ReturnType<typeof adaptBusyRanges> }> {
  const checkedAt = new Date().toISOString();
  let rows: Awaited<ReturnType<typeof fetchVehicleAvailability>>;
  try { rows = await bounded((signal) => fetchVehicleAvailability(teamSlug,vehicleSlug,window.start,window.end,signal)); }
  catch { return { authority: { status: 'UNKNOWN', reason: 'upstream_unavailable', retryAfterSeconds: 30 } }; }
  try {
    const ranges = adaptBusyRanges(rows);
    return { ranges, authority: { status: 'KNOWN', checkedAt, windowStart: window.start, windowEnd: window.end } };
  } catch { return { authority: { status: 'UNKNOWN', reason: 'invalid_response', retryAfterSeconds: 30 } }; }
}

export async function getSupabaseTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  // Independent reads — in series they were the storefront's whole TTFB.
  const [teamRow, fleetRows] = await Promise.all([fetchPublicTeam(teamSlug), fetchPublicTeamFleet(teamSlug)]);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);
  // Storefront quality gate (marketplace testing handoff, gap #3): vehicles
  // without a hero image render as blank cards, so they are excluded from
  // the public listing until photos are seeded. Direct vehicle URLs still
  // resolve — this filters the grid, not the catalog.
  const listable = fleetRows.filter((row) => Boolean(row.hero_image_url));
  return { team, vehicles: listable.map((row) => adaptFleetVehicle(row, team)) };
}

export async function getSupabaseVehicleContext(teamSlug: string, vehicleSlug: string, requestedWindow?: AvailabilityWindow): Promise<PublicVehicleContext | null> {
  const [teamRow, vehicleRow] = await Promise.all([bounded((signal) => fetchPublicTeam(teamSlug,signal)), bounded((signal) => fetchPublicVehicle(teamSlug, vehicleSlug,signal))]);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);
  if (!vehicleRow) return null;

  let window: AvailabilityWindow | undefined;
  try { window = requestedWindow ?? availabilityWindow(team.timezone); } catch { /* Invalid tenant timezone cannot establish authority. */ }
  const validWindow = window && validAvailabilityDate(window.start) && validAvailabilityDate(window.end) && window.end >= window.start &&
    (Date.parse(window.end)-Date.parse(window.start))/86400000 <= 365;
  // Media may degrade independently; failed availability stays UNKNOWN and
  // prevents a new request without taking down public metadata or galleries.
  // When the row already carries stable public photo URLs, skip the signing
  // call entirely: it is an uncacheable edge-function round trip on the TTFB
  // path, and the adapter prefers the public URLs anyway.
  const hasStablePhotos = (vehicleRow.photos ?? []).some((photo) => photo.url?.includes('/storage/v1/object/public/'));
  const [media, availability] = await Promise.all([
    hasStablePhotos
      ? Promise.resolve({ photos: [], expiresIn: 0 })
      : bounded((signal) => fetchSignedVehicleMedia(teamSlug, vehicleSlug,signal)).catch(() => ({ photos: [], expiresIn: 0 })),
    validWindow ? checkedAvailability(teamSlug,vehicleSlug,window!) : Promise.resolve({ authority: { status: 'UNKNOWN', reason: 'invalid_response', retryAfterSeconds: 30 } as AvailabilityAuthority, ranges: undefined }),
  ]);

  const vehicle = adaptVehicleDetail(vehicleRow, team, media);
  return { team, availabilityAuthority: availability.authority, vehicle: { ...vehicle, availabilityAuthority: availability.authority, ...(availability.ranges ? { unavailableRanges: availability.ranges } : {}) } };
}

export class AvailabilityUnavailableError extends Error {
  readonly code: 'availability_unknown' | 'dates_unavailable';
  readonly retryAfterSeconds = 30;
  constructor(code: 'availability_unknown' | 'dates_unavailable') {
    super(code === 'availability_unknown' ? "We couldn't confirm availability for these dates. Please refresh availability and try again." : 'These dates are unavailable. Please choose another range.');
    this.name = 'AvailabilityUnavailableError'; this.code = code;
  }
}

/** UI evidence is only a fail-safe preflight; it is not authorization or a hold.
 * Server quote/consent and the universal database guard remain final authority.
 */
export function requireLiveBookingAvailability(cart: BookingCart): void {
  if (!hasKnownAvailability(cart.vehicle,cart.dates.start,cart.dates.end)) throw new AvailabilityUnavailableError('availability_unknown');
  let today: string;
  try { today = availabilityWindow(cart.operator.timezone).start; } catch { throw new AvailabilityUnavailableError('availability_unknown'); }
  if (!rangeIsBookable(cart.vehicle,cart.dates.start,cart.dates.end,today)) throw new AvailabilityUnavailableError('dates_unavailable');
}

export async function createSupabaseRenterBooking(cart: BookingCart): Promise<CreateBookingResult> {
  requireLiveBookingAvailability(cart);
  const response = await postCreateBooking({
    team_slug: cart.operator.slug,
    vehicle_slug: cart.vehicle.slug,
    start_date: cart.dates.start,
    end_date: cart.dates.end,
    pickup_time: cart.pickupTime,
    // TODO(PROTECT_ENABLED): see domain/booking/protect.ts: an explicit 'decline' while off, never omitted (a missing tier is premium).
    protection: protectionForRequest(cart.protection),
    driver: {
      name: cart.driver.name,
      email: cart.driver.email ?? '',
      phone: cart.driver.phone,
    },
  });
  return {
    bookingRef: response.booking_ref,
    confirmationToken: response.confirmation_token,
    status: response.status,
    identityVerified: response.identity_verified,
  };
}

export async function getSupabaseBookingConfirmation(bookingRef: string, token?: string): Promise<BookingLookupResult> {
  const row = await fetchBookingByRef(bookingRef, token);
  if (!row) return null;
  if (!row.authorized || !row.team_slug || !row.vehicle_slug) {
    // D4: no token, no details.
    return { restricted: true, bookingRef: row.booking_ref, status: row.status };
  }

  // The catalog fetch is gated by marketplace visibility, so it fails if the
  // operator unlists the car, flags it 'maintenance', or the tenant is hidden
  // AFTER the booking exists. The renter still holds a token-authorized booking
  // and must keep their Pay/Cancel buttons, so fall back to a minimal context
  // built from the token row rather than dropping them to the restricted view.
  // The catch matters as much as the ??: the catalog RPCs THROW on any non-OK
  // response, so without it one transient failure rejects the whole lookup and
  // error-crashes the page for a renter holding a valid token (T-9). Money on
  // this path always comes from the row's live.* fields, never the catalog.
  const context = (await getSupabaseVehicleContext(row.team_slug, row.vehicle_slug).catch(() => null))
    ?? synthesizeContextFromRow(row);

  return {
    bookingRef: row.booking_ref,
    team: context.team,
    vehicle: context.vehicle,
    live: {
      status: row.status,
      startAt: row.start_at ?? '',
      endAt: row.end_at ?? '',
      totalCents: Number(row.total_cents ?? 0),
      paymentDueAt: row.payment_due_at ?? undefined,
      paidAt: row.paid_at ?? undefined,
      protectionTier: row.protection_tier ?? undefined,
      platformFeeCents: row.platform_fee_cents != null ? Number(row.platform_fee_cents) : undefined,
      protectionTotalCents: row.protection_total_cents != null ? Number(row.protection_total_cents) : undefined,
      stateFeeCents: row.state_fee_cents != null ? Number(row.state_fee_cents) : undefined,
      processingFeeCents: row.processing_fee_cents != null ? Number(row.processing_fee_cents) : undefined,
      operatorTaxCents: row.operator_tax_cents != null ? Number(row.operator_tax_cents) : undefined,
      operatorTaxLabel: row.operator_tax_label ?? undefined,
      timezone: row.timezone ?? undefined,
      identityVerified: row.identity_verified ?? undefined,
      supportEmail: row.support_email ?? undefined,
      supportPhone: row.support_phone ?? undefined,
      pickupAddress: row.pickup_address ?? undefined,
      pickupInstructions: row.pickup_instructions ?? undefined,
      mileageLimitPerDay: row.mileage_limit_per_day != null ? Number(row.mileage_limit_per_day) : undefined,
      mileageOverageRate: row.mileage_overage_rate != null ? Number(row.mileage_overage_rate) : undefined,
      cancellationPolicy: row.cancellation_policy ?? undefined,
    },
  };
}
