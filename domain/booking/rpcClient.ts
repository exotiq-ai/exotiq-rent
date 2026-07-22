import { getFunctionsBaseUrl, getSupabaseAnonKey, getSupabaseUrl } from './config';

/**
 * Live (supabase-mode) client for the five M3 public read RPCs + signed
 * media. Row types mirror the RETURNS TABLE shapes in
 * exotiq-spark-mvp-flow/supabase/migrations/20260715220100_rent_public_read_rpcs.sql
 * exactly — adapters.ts converts them to domain types (cents, camelCase).
 */

export type RpcTeamRow = {
  slug: string;
  name: string;
  logo_url: string | null;
  public_description: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  currency: string | null;
};

export type RpcFleetVehicleRow = {
  vehicle_slug: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  daily_rate: number | string | null; // numeric dollars from Postgres
  hero_image_url: string | null;
  min_rental_days: number | null;
};

export type RpcVehiclePhoto = {
  url: string | null;
  thumbnail_url: string | null;
  display_order: number | null;
};

export type RpcVehicleDetailRow = RpcFleetVehicleRow & {
  team_slug: string;
  team_name: string;
  rate_3hr: number | string | null;
  rate_6hr: number | string | null;
  rate_multiday: number | string | null;
  default_mileage_limit: number | null;
  mileage_overage_rate: number | string | null;
  photos: RpcVehiclePhoto[] | null;
  pickup_city: string | null;
  pickup_state: string | null;
  timezone: string | null;
  currency: string | null;
};

export type RpcBusyRangeRow = {
  busy_start: string;
  busy_end: string;
};

export type RpcQuoteRow = {
  currency: string;
  rental_days: number;
  daily_rate_cents: number;
  rental_subtotal_cents: number;
  operator_total_cents: number;
  platform_fee_percent: number | string;
  platform_fee_cents: number;
  protection_tier: string;
  protection_daily_cents: number;
  protection_total_cents: number;
  exotiq_total_cents: number;
  grand_total_cents: number;
};

export type SignedMediaResponse = {
  photos: Array<{ signedUrl: string; thumbnailUrl: string | null; displayOrder: number | null }>;
  expiresIn: number;
};

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: getSupabaseAnonKey(),
    Authorization: `Bearer ${getSupabaseAnonKey()}`,
  };
}

async function rpc<T>(name: string, args: Record<string, unknown>, options: { noStore?: boolean } = {}): Promise<T> {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
    // Availability is booking-sensitive; catalog reads revalidate on a short
    // cycle so operator edits show up without redeploys.
    ...(options.noStore ? { cache: 'no-store' as const } : { next: { revalidate: 300 } }),
  });
  if (!response.ok) {
    throw new Error(`${name} failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchPublicTeam(teamSlug: string): Promise<RpcTeamRow | null> {
  const rows = await rpc<RpcTeamRow[]>('public_team_by_slug', { _team_slug: teamSlug });
  return rows[0] ?? null;
}

export async function fetchPublicTeamFleet(teamSlug: string): Promise<RpcFleetVehicleRow[]> {
  return rpc<RpcFleetVehicleRow[]>('public_team_fleet', { _team_slug: teamSlug });
}

export async function fetchPublicVehicle(teamSlug: string, vehicleSlug: string): Promise<RpcVehicleDetailRow | null> {
  const rows = await rpc<RpcVehicleDetailRow[]>('public_vehicle_by_slug', {
    _team_slug: teamSlug,
    _vehicle_slug: vehicleSlug,
  });
  return rows[0] ?? null;
}

export async function fetchVehicleAvailability(
  teamSlug: string,
  vehicleSlug: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<RpcBusyRangeRow[]> {
  return rpc<RpcBusyRangeRow[]>(
    'public_vehicle_availability',
    { _team_slug: teamSlug, _vehicle_slug: vehicleSlug, _range_start: rangeStart, _range_end: rangeEnd },
    { noStore: true },
  );
}

export async function fetchVehicleQuote(
  teamSlug: string,
  vehicleSlug: string,
  startDate: string,
  endDate: string,
  options: { protection?: 'premium' | 'standard' | 'decline' } = {},
): Promise<RpcQuoteRow | null> {
  const rows = await rpc<RpcQuoteRow[]>(
    'public_vehicle_quote',
    {
      _team_slug: teamSlug,
      _vehicle_slug: vehicleSlug,
      _start_date: startDate,
      _end_date: endDate,
      _options: options.protection ? { protection: options.protection } : {},
    },
    { noStore: true },
  );
  return rows[0] ?? null;
}

export type RpcBookingByRefRow = {
  booking_ref: string;
  status: string;
  team_slug: string | null;
  team_name: string | null;
  vehicle_slug: string | null;
  vehicle_name: string | null;
  start_at: string | null;
  end_at: string | null;
  total_cents: number | null;
  currency: string | null;
  authorized: boolean;
};

export async function fetchBookingByRef(bookingRef: string, token?: string): Promise<RpcBookingByRefRow | null> {
  const rows = await rpc<RpcBookingByRefRow[]>(
    'public_booking_by_ref',
    { _booking_ref: bookingRef, _token: token ?? null },
    { noStore: true },
  );
  return rows[0] ?? null;
}

export type CreateBookingRequest = {
  team_slug: string;
  vehicle_slug: string;
  start_date: string;
  end_date: string;
  pickup_time: string;
  protection: 'premium' | 'standard' | 'decline';
  driver: { name: string; email: string; phone: string };
};

export type CreateBookingResponse = {
  booking_ref: string;
  confirmation_token: string;
  status: string;
  identity_verified: boolean;
};

export async function postCreateBooking(request: CreateBookingRequest): Promise<CreateBookingResponse> {
  const response = await fetch(`${getFunctionsBaseUrl()}/rent-create-booking`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(request),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Booking could not be created (${response.status})`);
  }
  return body as CreateBookingResponse;
}

export async function fetchSignedVehicleMedia(teamSlug: string, vehicleSlug: string): Promise<SignedMediaResponse> {
  const url = `${getFunctionsBaseUrl()}/rent-public-media?team=${encodeURIComponent(teamSlug)}&vehicle=${encodeURIComponent(vehicleSlug)}`;
  const response = await fetch(url, {
    headers: headers(),
    // Signed URLs expire in 1h; never cache past a fraction of that.
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    // Media is progressive enhancement — a photo-less vehicle should not
    // take down the page. Callers fall back to RPC-provided URLs.
    return { photos: [], expiresIn: 0 };
  }
  return response.json() as Promise<SignedMediaResponse>;
}
