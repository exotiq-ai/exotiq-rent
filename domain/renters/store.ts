/**
 * Renter store (MP-14): PostgREST over the Exotiq-owned project, service
 * role only. Every call is `cache: 'no-store'`; nothing here is ever
 * rendered from a cache. Errors carry the status and the first line of the
 * body — enough to debug, never the key.
 */
import { rentersServiceRoleKey, rentersSupabaseUrl } from './config';

export type RenterRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  marketing_consent: boolean;
  consented_at: string | null;
  consent_source: string | null;
  confirmed_at: string | null;
  confirm_token_hash: string | null;
  confirm_sent_at: string | null;
  unsubscribed_at: string | null;
  first_source: string | null;
  first_booking_ref: string | null;
  last_booking_ref: string | null;
  bookings_count: number;
  created_at: string;
};

export type SavedCarRow = { renter_id: string; team_slug: string; vehicle_slug: string; vehicle_name: string | null; saved_at: string };

export type AlertRow = {
  id: string;
  renter_id: string;
  team_slug: string | null;
  vehicle_slug: string | null;
  start_on: string;
  end_on: string;
  status: 'active' | 'notified' | 'expired' | 'cancelled';
  created_at: string;
  renters?: Pick<RenterRow, 'email' | 'name' | 'confirmed_at' | 'unsubscribed_at'> | null;
};

const RENTER_COLUMNS = 'id,email,name,phone,marketing_consent,consented_at,consent_source,confirmed_at,confirm_token_hash,confirm_sent_at,unsubscribed_at,first_source,first_booking_ref,last_booking_ref,bookings_count,created_at';

async function rest<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const key = rentersServiceRoleKey();
  const res = await fetch(`${rentersSupabaseUrl()}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).split('\n')[0].slice(0, 200);
    throw new Error(`renters store ${res.status} on ${path.split('?')[0]}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const enc = encodeURIComponent;

export async function findRenterByEmail(email: string): Promise<RenterRow | null> {
  const rows = await rest<RenterRow[]>(`renters?email=eq.${enc(email)}&select=${RENTER_COLUMNS}&limit=1`);
  return rows[0] ?? null;
}

export async function findRenterById(id: string): Promise<RenterRow | null> {
  const rows = await rest<RenterRow[]>(`renters?id=eq.${enc(id)}&select=${RENTER_COLUMNS}&limit=1`);
  return rows[0] ?? null;
}

export async function findRenterByConfirmHash(hash: string): Promise<RenterRow | null> {
  const rows = await rest<RenterRow[]>(`renters?confirm_token_hash=eq.${enc(hash)}&select=${RENTER_COLUMNS}&limit=1`);
  return rows[0] ?? null;
}

export async function insertRenter(fields: Partial<RenterRow> & { email: string } & Record<string, unknown>): Promise<RenterRow> {
  const rows = await rest<RenterRow[]>(`renters?select=${RENTER_COLUMNS}`, { method: 'POST', body: fields, prefer: 'return=representation' });
  return rows[0];
}

export async function patchRenter(id: string, fields: Record<string, unknown>): Promise<RenterRow> {
  const rows = await rest<RenterRow[]>(`renters?id=eq.${enc(id)}&select=${RENTER_COLUMNS}`, { method: 'PATCH', body: fields, prefer: 'return=representation' });
  return rows[0];
}

export async function addSavedCars(renterId: string, cars: Array<{ team_slug: string; vehicle_slug: string; vehicle_name?: string | null }>): Promise<void> {
  if (cars.length === 0) return;
  await rest<void>('saved_cars?on_conflict=renter_id,team_slug,vehicle_slug', {
    method: 'POST',
    body: cars.map((c) => ({ renter_id: renterId, team_slug: c.team_slug, vehicle_slug: c.vehicle_slug, vehicle_name: c.vehicle_name ?? null })),
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
}

export async function listSavedCars(renterId: string): Promise<SavedCarRow[]> {
  return rest<SavedCarRow[]>(`saved_cars?renter_id=eq.${enc(renterId)}&select=renter_id,team_slug,vehicle_slug,vehicle_name,saved_at&order=saved_at.desc`);
}

export async function addAlert(renterId: string, alert: { team_slug: string | null; vehicle_slug: string | null; start_on: string; end_on: string }): Promise<AlertRow> {
  const rows = await rest<AlertRow[]>('availability_alerts?select=id,renter_id,team_slug,vehicle_slug,start_on,end_on,status,created_at', {
    method: 'POST',
    body: { renter_id: renterId, ...alert },
    prefer: 'return=representation',
  });
  return rows[0];
}

export async function listActiveAlerts(): Promise<AlertRow[]> {
  return rest<AlertRow[]>('availability_alerts?status=eq.active&select=id,renter_id,team_slug,vehicle_slug,start_on,end_on,status,created_at,renters(email,name,confirmed_at,unsubscribed_at)&order=start_on.asc&limit=1000');
}

export async function listActiveAlertsForRenter(renterId: string): Promise<AlertRow[]> {
  return rest<AlertRow[]>(`availability_alerts?renter_id=eq.${enc(renterId)}&status=eq.active&select=id,renter_id,team_slug,vehicle_slug,start_on,end_on,status,created_at&order=start_on.asc`);
}

export async function updateAlert(id: string, fields: Partial<Pick<AlertRow, 'status'>> & { last_checked_at?: string; notified_at?: string }): Promise<void> {
  await rest<void>(`availability_alerts?id=eq.${enc(id)}`, { method: 'PATCH', body: fields, prefer: 'return=minimal' });
}

export async function cancelAlertsForRenter(renterId: string): Promise<void> {
  await rest<void>(`availability_alerts?renter_id=eq.${enc(renterId)}&status=eq.active`, { method: 'PATCH', body: { status: 'cancelled' }, prefer: 'return=minimal' });
}

export async function logEvent(event: { renter_id?: string | null; kind: string; source?: string | null; path?: string | null; meta?: Record<string, unknown> }): Promise<void> {
  await rest<void>('capture_events', { method: 'POST', body: { renter_id: event.renter_id ?? null, kind: event.kind, source: event.source ?? null, path: event.path ?? null, meta: event.meta ?? {} }, prefer: 'return=minimal' });
}

export async function logEmail(entry: { renter_id?: string | null; kind: string; to_email: string; provider_id?: string | null; status?: string; error?: string | null }): Promise<void> {
  await rest<void>('email_log', { method: 'POST', body: { renter_id: entry.renter_id ?? null, kind: entry.kind, to_email: entry.to_email, provider_id: entry.provider_id ?? null, status: entry.status ?? 'sent', error: entry.error ?? null }, prefer: 'return=minimal' });
}
