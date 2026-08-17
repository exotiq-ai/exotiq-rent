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
import type { BookingCart } from './types';
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
  return {
    team: {
      id: '', slug: teamSlug, name: row.team_name ?? 'Your operator',
      city: '', state: '', phone: '',
    },
    vehicle: {
      id: '', slug: vehicleSlug, operatorId: '', name: vehicleName,
      shortName: vehicleName, year: 0, make: vehicleName.split(' ')[0] ?? '', model: '',
      dailyRateCents: 0, minRentalDays: 1, securityDepositCents: 0,
      photos: [], heroImage: '', footnote: '',
      pickupLocation: { name: '', address: '', city: '', state: '' },
    },
  };
}

/**
 * Supabase-mode reads (M4): real storefronts from the five public RPCs.
 * Server-side visibility gating (marketplace_visible, demo exclusion) is
 * enforced inside the RPCs — a null here is a true 404.
 */

const AVAILABILITY_WINDOW_DAYS = 180;

function availabilityWindow(): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start.getTime() + AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getSupabaseTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  const teamRow = await fetchPublicTeam(teamSlug);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);
  const fleetRows = await fetchPublicTeamFleet(teamSlug);
  // Storefront quality gate (marketplace testing handoff, gap #3): vehicles
  // without a hero image render as blank cards, so they are excluded from
  // the public listing until photos are seeded. Direct vehicle URLs still
  // resolve — this filters the grid, not the catalog.
  const listable = fleetRows.filter((row) => Boolean(row.hero_image_url));
  return { team, vehicles: listable.map((row) => adaptFleetVehicle(row, team)) };
}

export async function getSupabaseVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  const teamRow = await fetchPublicTeam(teamSlug);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);

  const vehicleRow = await fetchPublicVehicle(teamSlug, vehicleSlug);
  if (!vehicleRow) return null;

  const window = availabilityWindow();
  // Media and availability are enhancements — fetch in parallel and degrade
  // to RPC photo URLs / an open calendar rather than failing the page.
  const [media, busyRows] = await Promise.all([
    fetchSignedVehicleMedia(teamSlug, vehicleSlug).catch(() => ({ photos: [], expiresIn: 0 })),
    fetchVehicleAvailability(teamSlug, vehicleSlug, window.start, window.end).catch(() => []),
  ]);

  const vehicle = adaptVehicleDetail(vehicleRow, team, media);
  return { team, vehicle: { ...vehicle, unavailableRanges: adaptBusyRanges(busyRows) } };
}

export async function createSupabaseRenterBooking(cart: BookingCart): Promise<CreateBookingResult> {
  const response = await postCreateBooking({
    team_slug: cart.operator.slug,
    vehicle_slug: cart.vehicle.slug,
    start_date: cart.dates.start,
    end_date: cart.dates.end,
    pickup_time: cart.pickupTime,
    protection: cart.protection,
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
    },
  };
}
