/**
 * Renter store (MP-14): PostgREST over the Exotiq-owned project, service
 * role only. Every call is `cache: 'no-store'`. Errors carry the status,
 * the table and PostgREST's error code — never the response body, which can
 * quote the address (a unique-violation message does).
 */
import { rentersServiceRoleKey, rentersSupabaseUrl } from './config';

export type RenterRow = {
  id: string;
  email: string;
  name: string | null;
  marketing_consent: boolean;
  consented_at: string | null;
  consent_source: string | null;
  consent_text_version: string | null;
  consent_requested_at: string | null;
  confirmed_at: string | null;
  confirm_token_hash: string | null;
  confirm_sent_at: string | null;
  /** Comma list of what the pending link confirms: address, list, alert, consent. */
  confirm_scope: string | null;
  confirm_issued_at: string | null;
  unsubscribed_at: string | null;
  alerts_paused_at: string | null;
  first_source: string | null;
  first_booking_ref: string | null;
  last_booking_ref: string | null;
  bookings_count: number;
  created_at: string;
};

export type SavedCarRow = { renter_id: string; team_slug: string; vehicle_slug: string; vehicle_name: string | null; saved_at: string };

export type AlertStatus = 'active' | 'notifying' | 'notified' | 'expired' | 'cancelled';

export type AlertRow = {
  id: string;
  renter_id: string;
  team_slug: string | null;
  vehicle_slug: string | null;
  start_on: string;
  end_on: string;
  status: AlertStatus;
  created_at: string;
  renters?: Pick<RenterRow, 'email' | 'name' | 'confirmed_at' | 'alerts_paused_at'> | null;
};

export class StoreError extends Error {
  constructor(public readonly status: number, public readonly code: string | null, path: string) {
    super(`renters store ${status}${code ? ` (${code})` : ''} on ${path}`);
  }
}

const RENTER_COLUMNS = 'id,email,name,marketing_consent,consented_at,consent_source,consent_text_version,consent_requested_at,confirmed_at,confirm_token_hash,confirm_sent_at,confirm_scope,confirm_issued_at,unsubscribed_at,alerts_paused_at,first_source,first_booking_ref,last_booking_ref,bookings_count,created_at';
const ALERT_COLUMNS = 'id,renter_id,team_slug,vehicle_slug,start_on,end_on,status,created_at';

async function rest<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const key = rentersServiceRoleKey();
  const res = await fetch(`${rentersSupabaseUrl()}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let code: string | null = null;
    try {
      code = ((await res.json()) as { code?: string }).code ?? null;
    } catch {
      // body not JSON — keep it out of the error regardless
    }
    throw new StoreError(res.status, code, path.split('?')[0]);
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

export async function insertRenter(fields: { email: string } & Record<string, unknown>): Promise<RenterRow> {
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

export type AlertScope = { team_slug: string | null; vehicle_slug: string | null; start_on: string; end_on: string };

/** The existing active alert for this exact ask, if any (a repeat submit must not double-notify). */
export async function findActiveAlert(renterId: string, scope: AlertScope): Promise<AlertRow | null> {
  const team = scope.team_slug ? `team_slug=eq.${enc(scope.team_slug)}` : 'team_slug=is.null';
  const vehicle = scope.vehicle_slug ? `vehicle_slug=eq.${enc(scope.vehicle_slug)}` : 'vehicle_slug=is.null';
  const rows = await rest<AlertRow[]>(`availability_alerts?renter_id=eq.${enc(renterId)}&status=eq.active&${team}&${vehicle}&start_on=eq.${scope.start_on}&end_on=eq.${scope.end_on}&select=${ALERT_COLUMNS}&limit=1`);
  return rows[0] ?? null;
}

export async function countActiveAlerts(renterId: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`availability_alerts?renter_id=eq.${enc(renterId)}&status=eq.active&select=id&limit=50`);
  return rows.length;
}

export async function addAlert(renterId: string, scope: AlertScope): Promise<AlertRow> {
  const rows = await rest<AlertRow[]>(`availability_alerts?select=${ALERT_COLUMNS}`, { method: 'POST', body: { renter_id: renterId, ...scope }, prefer: 'return=representation' });
  return rows[0];
}

/**
 * Active alerts whose renter is confirmed and not paused, joined so the job
 * never reads a row it could not act on; paged, so a flood of throwaway
 * alerts cannot push real ones past a single read.
 */
export async function listActiveAlerts(): Promise<AlertRow[]> {
  const page = 500;
  const all: AlertRow[] = [];
  for (let offset = 0; offset < 20000; offset += page) {
    const rows = await rest<AlertRow[]>(`availability_alerts?status=eq.active&select=${ALERT_COLUMNS},renters!inner(email,name,confirmed_at,alerts_paused_at)&renters.confirmed_at=not.is.null&renters.alerts_paused_at=is.null&order=start_on.asc,id.asc&limit=${page}&offset=${offset}`);
    all.push(...rows);
    if (rows.length < page) break;
  }
  return all;
}

/** Alerts whose pickup day has passed are expired regardless of the renter's state. */
export async function expirePastAlerts(todayIso: string, nowIso: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`availability_alerts?status=eq.active&start_on=lt.${todayIso}&select=id`, { method: 'PATCH', body: { status: 'expired', last_checked_at: nowIso }, prefer: 'return=representation' });
  return rows.length;
}

/** Alerts a week old whose address never confirmed, or is paused by an unsubscribe, are retired so they cannot pile up. */
export async function expireUnconfirmedAlerts(olderThanIso: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`availability_alerts?status=eq.active&created_at=lt.${enc(olderThanIso)}&select=id,renters!inner(confirmed_at,alerts_paused_at)&renters.or=(confirmed_at.is.null,alerts_paused_at.not.is.null)&limit=500`);
  if (rows.length === 0) return 0;
  await rest<void>(`availability_alerts?id=in.(${rows.map((r) => r.id).join(',')})`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' });
  return rows.length;
}

/** A row left in `notifying` by a run that died mid-send goes back to active after an hour. */
export async function releaseStaleClaims(olderThanIso: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`availability_alerts?status=eq.notifying&last_checked_at=lt.${enc(olderThanIso)}&select=id`, { method: 'PATCH', body: { status: 'active' }, prefer: 'return=representation' });
  return rows.length;
}

/** Claim an alert before sending: only one worker can move it from active to notifying. */
export async function claimAlert(id: string, nowIso: string): Promise<boolean> {
  const rows = await rest<Array<{ id: string }>>(`availability_alerts?id=eq.${enc(id)}&status=eq.active&select=id`, { method: 'PATCH', body: { status: 'notifying', last_checked_at: nowIso }, prefer: 'return=representation' });
  return rows.length === 1;
}

/** Retention: an address that never confirmed is forgotten after the window; an expired pending link is dropped. */
export async function purgeUnconfirmedRenters(olderThanIso: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`renters?confirmed_at=is.null&created_at=lt.${enc(olderThanIso)}&select=id`, { method: 'DELETE', prefer: 'return=representation' });
  return rows.length;
}

export async function expireConfirmTokens(olderThanIso: string): Promise<number> {
  const rows = await rest<Array<{ id: string }>>(`renters?confirm_token_hash=not.is.null&confirm_issued_at=lt.${enc(olderThanIso)}&select=id`, { method: 'PATCH', body: { confirm_token_hash: null, confirm_scope: null }, prefer: 'return=representation' });
  return rows.length;
}

export async function updateAlert(id: string, fields: { status?: AlertStatus; last_checked_at?: string; notified_at?: string }): Promise<void> {
  await rest<void>(`availability_alerts?id=eq.${enc(id)}`, { method: 'PATCH', body: fields, prefer: 'return=minimal' });
}

export async function cancelAlertsForRenter(renterId: string): Promise<void> {
  await rest<void>(`availability_alerts?renter_id=eq.${enc(renterId)}&status=in.(active,notifying)`, { method: 'PATCH', body: { status: 'cancelled' }, prefer: 'return=minimal' });
}

export async function logEvent(event: { renter_id?: string | null; kind: string; source?: string | null; path?: string | null; ip_hash?: string | null; meta?: Record<string, unknown> }): Promise<void> {
  await rest<void>('capture_events', { method: 'POST', body: { renter_id: event.renter_id ?? null, kind: event.kind, source: event.source ?? null, path: event.path ?? null, ip_hash: event.ip_hash ?? null, meta: event.meta ?? {} }, prefer: 'return=minimal' });
}

/** Recent capture events by IP hash or by renter — the rate-limit evidence. */
export async function countRecentEvents(by: { ip_hash?: string; renter_id?: string }, sinceIso: string, cap = 200): Promise<number> {
  const filter = by.ip_hash ? `ip_hash=eq.${enc(by.ip_hash)}` : `renter_id=eq.${enc(by.renter_id ?? '')}`;
  const rows = await rest<Array<{ id: number }>>(`capture_events?${filter}&created_at=gte.${enc(sinceIso)}&select=id&limit=${cap}`);
  return rows.length;
}

export async function logEmail(entry: { renter_id?: string | null; kind: string; to_email: string; provider_id?: string | null; status?: string; error?: string | null }): Promise<void> {
  await rest<void>('email_log', { method: 'POST', body: { renter_id: entry.renter_id ?? null, kind: entry.kind, to_email: entry.to_email, provider_id: entry.provider_id ?? null, status: entry.status ?? 'sent', error: entry.error ?? null }, prefer: 'return=minimal' });
}

/** Sent e-mails of the given kinds to an address since a moment — the send cooldowns. */
export async function countRecentEmails(toEmail: string, kinds: string[], sinceIso: string): Promise<number> {
  const rows = await rest<Array<{ id: number }>>(`email_log?to_email=eq.${enc(toEmail)}&status=eq.sent&kind=in.(${kinds.map(enc).join(',')})&created_at=gte.${enc(sinceIso)}&select=id&limit=50`);
  return rows.length;
}
