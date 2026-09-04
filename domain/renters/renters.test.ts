import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCapture } from './validate';
import { hashIp, hashToken, looksLikeToken, newToken, safeEqual, unsubscribeToken, unsubscribeTokenValid } from './tokens';
import { decideAlerts, type CatalogKey } from './alerts';
import type { AlertRow } from './store';

const TODAY = '2026-09-04';

describe('validateCapture', () => {
  it('accepts a footer signup with consent', () => {
    const r = validateCapture({ email: ' Gregory@Example.com ', source: 'footer', consent: true }, TODAY);
    expect(r.ok && r.value.email).toBe('gregory@example.com');
    expect(r.ok && r.value.consent).toBe(true);
  });
  it('rejects the honeypot, bad e-mails, unknown sources', () => {
    expect(validateCapture({ email: 'a@b.co', source: 'footer', hp_field: 'http://spam' }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'not-an-email', source: 'footer' }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'a@b.co', source: 'newsletter' }, TODAY).ok).toBe(false);
    expect(validateCapture('nope', TODAY).ok).toBe(false);
  });
  it('a saved list needs at least one valid car; request-supplied names are dropped', () => {
    expect(validateCapture({ email: 'a@b.co', source: 'save_list', saved: [] }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'a@b.co', source: 'save_list', saved: [{ team_slug: 'exotiq', vehicle_slug: 'Bad Slug' }] }, TODAY).ok).toBe(false);
    const r = validateCapture({ email: 'a@b.co', source: 'save_list', saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', name: 'Audi S8 Plus' }] }, TODAY);
    expect(r.ok && r.value.saved).toEqual([{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }]);
  });
  it('alerts need a future window (one day of grace) inside the horizon, and a car needs its operator', () => {
    const base = { email: 'a@b.co', source: 'alert' as const };
    expect(validateCapture({ ...base, alert: { start: '2026-09-10', end: '2026-09-10', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2026-09-01', end: '2026-09-03', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2026-09-03', end: '2026-09-05', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(true);
    expect(validateCapture({ ...base, alert: { start: '2027-05-01', end: '2027-05-03', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2026-09-10', end: '2026-09-12', team_slug: null, vehicle_slug: 'car' } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base }, TODAY).ok).toBe(false);
  });
  it('a booking capture needs both the reference and the token', () => {
    expect(validateCapture({ email: 'a@b.co', source: 'booking', booking_ref: 'BK-03500' }, TODAY).ok).toBe(false);
    const r = validateCapture({ email: 'a@b.co', source: 'booking', consent: true, booking_ref: 'BK-03500', booking_token: 'tok_abc-123', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', name: 'G' }, TODAY);
    expect(r.ok && r.value.booking_token).toBe('tok_abc-123');
    expect(validateCapture({ email: 'a@b.co', source: 'booking', booking_ref: 'BK 03500', booking_token: 'x' }, TODAY).ok).toBe(false);
  });
});

describe('tokens', () => {
  it('mints url-safe tokens whose hashes are stable and never equal the token', () => {
    const t = newToken();
    expect(looksLikeToken(t)).toBe(true);
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toBe(t);
    expect(looksLikeToken('short')).toBe(false);
  });
  it('unsubscribe tokens are derived per renter and secret, and a previous secret keeps old links alive', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const a = unsubscribeToken(id, 's1');
    expect(a).toBe(unsubscribeToken(id, 's1'));
    expect(a).not.toBe(unsubscribeToken('22222222-2222-4222-8222-222222222222', 's1'));
    expect(unsubscribeTokenValid(id, a, 's1')).toBe(true);
    expect(unsubscribeTokenValid(id, a, 's2')).toBe(false);
    expect(unsubscribeTokenValid(id, a, 's2', 's1')).toBe(true);
    expect(safeEqual(a, `${a}x`)).toBe(false);
  });
  it('ip evidence is keyed, short, and differs from the raw hash', () => {
    expect(hashIp('1.2.3.4', 'secret')).toHaveLength(32);
    expect(hashIp('1.2.3.4', 'secret')).not.toBe(hashIp('1.2.3.4', 'other'));
  });
});

function alert(over: Partial<AlertRow>): AlertRow {
  return { id: over.id ?? 'a1', renter_id: 'r1', team_slug: null, vehicle_slug: null, start_on: '2026-09-10', end_on: '2026-09-12', status: 'active', created_at: '2026-09-01T00:00:00Z', renters: { email: 'a@b.co', name: null, confirmed_at: '2026-09-01T00:00:00Z', alerts_paused_at: null }, ...over };
}

describe('decideAlerts', () => {
  const catalog: CatalogKey[] = [
    { team_slug: 'exotiq', vehicle_slug: 'a', min_rental_days: 1, listed: true },
    { team_slug: 'exotiq', vehicle_slug: 'b', min_rental_days: 1, listed: true },
    { team_slug: 'exotiq', vehicle_slug: 'long', min_rental_days: 3, listed: true },
    { team_slug: 'exotiq', vehicle_slug: 'nohero', min_rental_days: 1, listed: false },
    { team_slug: 'bay', vehicle_slug: 'c', min_rental_days: 1, listed: true },
  ];
  const all = () => catalog;
  it('notifies a car alert only when that car is free', () => {
    const a = alert({ team_slug: 'exotiq', vehicle_slug: 'a' });
    expect(decideAlerts([a], TODAY, all, new Map([[a.id, new Set(['exotiq/a'])]]))[0].action).toBe('wait');
    const d = decideAlerts([a], TODAY, all, new Map([[a.id, new Set(['exotiq/b'])]]))[0];
    expect(d.action).toBe('notify');
    expect(d.freeKeys).toEqual(['exotiq/a']);
  });
  it('operator and marketplace alerts list every free car in scope, minus long minimum stays and hidden cars', () => {
    const t = alert({ id: 't', team_slug: 'exotiq' });
    const any = alert({ id: 'any' });
    const busy = new Set(['exotiq/a']);
    expect(decideAlerts([t], TODAY, all, new Map([[t.id, busy]]))[0].freeKeys).toEqual(['exotiq/b']);
    expect(decideAlerts([any], TODAY, all, new Map([[any.id, busy]]))[0].freeKeys).toEqual(['exotiq/b', 'bay/c']);
    const week = alert({ id: 'w', team_slug: 'exotiq', start_on: '2026-09-10', end_on: '2026-09-17' });
    expect(decideAlerts([week], TODAY, all, new Map([[week.id, new Set<string>()]]))[0].freeKeys).toEqual(['exotiq/a', 'exotiq/b', 'exotiq/long']);
  });
  it('expires past windows, skips unconfirmed or paused renters, waits without a busy read', () => {
    expect(decideAlerts([alert({ start_on: '2026-09-01', end_on: '2026-09-03' })], TODAY, all, new Map())[0].action).toBe('expire');
    expect(decideAlerts([alert({ renters: { email: 'a@b.co', name: null, confirmed_at: null, alerts_paused_at: null } })], TODAY, all, new Map([['a1', new Set<string>()]]))[0].action).toBe('skip');
    expect(decideAlerts([alert({ renters: { email: 'a@b.co', name: null, confirmed_at: '2026-09-01T00:00:00Z', alerts_paused_at: '2026-09-02T00:00:00Z' } })], TODAY, all, new Map([['a1', new Set<string>()]]))[0].action).toBe('skip');
    expect(decideAlerts([alert({})], TODAY, all, new Map())[0].action).toBe('wait');
  });
});

// ---- capture orchestration, store, mail and the tenant booking read mocked ----
vi.mock('./store', async () => {
  const actual = await vi.importActual<typeof import('./store')>('./store');
  const renters = new Map<string, Record<string, unknown>>();
  const alerts: Array<Record<string, unknown>> = [];
  const emails: Array<{ to_email: string; kind: string; status: string; created_at: number }> = [];
  const events: Array<{ ip_hash: string | null; renter_id: string | null; created_at: number }> = [];
  let seq = 0;
  const now = () => Date.now();
  const api = {
    StoreError: actual.StoreError,
    __renters: renters, __alerts: alerts, __emails: emails, __events: events,
    __reset: () => { renters.clear(); alerts.length = 0; emails.length = 0; events.length = 0; seq = 0; },
    findRenterByEmail: vi.fn(async (email: string) => (renters.get(email) as never) ?? null),
    findRenterById: vi.fn(async (id: string) => (Array.from(renters.values()).find((r) => r.id === id) as never) ?? null),
    findRenterByConfirmHash: vi.fn(async (hash: string) => (Array.from(renters.values()).find((r) => r.confirm_token_hash === hash) as never) ?? null),
    insertRenter: vi.fn(async (fields: Record<string, unknown>) => {
      if (renters.has(fields.email as string)) throw new actual.StoreError(409, '23505', 'renters');
      const row = { id: `00000000-0000-4000-8000-00000000000${++seq}`, name: null, phone: null, marketing_consent: false, consented_at: null, consent_source: null, consent_text_version: null, consent_requested_at: null, confirmed_at: null, confirm_token_hash: null, confirm_sent_at: null, unsubscribed_at: null, alerts_paused_at: null, first_source: null, first_booking_ref: null, last_booking_ref: null, bookings_count: 0, created_at: 'now', ...fields };
      renters.set(fields.email as string, row);
      return row as never;
    }),
    patchRenter: vi.fn(async (id: string, fields: Record<string, unknown>) => { const row = Array.from(renters.values()).find((r) => r.id === id)!; Object.assign(row, fields); return row as never; }),
    addSavedCars: vi.fn(async () => undefined),
    listSavedCars: vi.fn(async () => [{ renter_id: 'x', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', vehicle_name: 'Audi S8 Plus', saved_at: 'now' }]),
    findActiveAlert: vi.fn(async (renterId: string, scope: Record<string, unknown>) => (alerts.find((a) => a.renter_id === renterId && a.status === 'active' && a.start_on === scope.start_on && a.end_on === scope.end_on && a.team_slug === scope.team_slug && a.vehicle_slug === scope.vehicle_slug) as never) ?? null),
    countActiveAlerts: vi.fn(async (renterId: string) => alerts.filter((a) => a.renter_id === renterId && a.status === 'active').length),
    addAlert: vi.fn(async (renterId: string, scope: Record<string, unknown>) => { const row = { id: `al-${alerts.length + 1}`, renter_id: renterId, status: 'active', ...scope }; alerts.push(row); return row as never; }),
    cancelAlertsForRenter: vi.fn(async (renterId: string) => { for (const a of alerts) if (a.renter_id === renterId && a.status === 'active') a.status = 'cancelled'; }),
    logEvent: vi.fn(async (e: { ip_hash?: string | null; renter_id?: string | null }) => { events.push({ ip_hash: e.ip_hash ?? null, renter_id: e.renter_id ?? null, created_at: now() }); }),
    countRecentEvents: vi.fn(async (by: { ip_hash?: string; renter_id?: string }) => events.filter((e) => (by.ip_hash ? e.ip_hash === by.ip_hash : e.renter_id === by.renter_id)).length),
    logEmail: vi.fn(async (e: { to_email: string; kind: string; status?: string }) => { emails.push({ to_email: e.to_email, kind: e.kind, status: e.status ?? 'sent', created_at: now() }); }),
    countRecentEmails: vi.fn(async (to: string, kinds: string[]) => emails.filter((e) => e.to_email === to && e.status === 'sent' && kinds.includes(e.kind)).length),
  };
  return api;
});
vi.mock('./email', async () => {
  const actual = await vi.importActual<typeof import('./email')>('./email');
  const { logEmail } = await import('./store');
  return { ...actual, sendMail: vi.fn(async (mail: { to: string; kind: string; renterId?: string | null }) => { await logEmail({ renter_id: mail.renterId, kind: mail.kind, to_email: mail.to }); return { id: 'mail-1' }; }) };
});
vi.mock('../booking/service', () => ({
  getMarketplaceListings: vi.fn(async () => ({ listings: [{ team: { slug: 'exotiq', name: 'Exotiq', city: 'Scottsdale' }, vehicle: { slug: '2017-audi-s8', name: 'Audi S8 Plus', dailyRateCents: 200 }, photoCount: 1 }], totalCount: 1 })),
}));
vi.mock('../booking/rpcClient', () => ({
  // BK-1 belongs to a@b.co (hash bound); BK-2 is authorized but the backend does not yet return the hash.
  fetchBookingByRef: vi.fn(async (ref: string, token?: string) => {
    if (ref === 'BK-1' && token === 'good-token') return { booking_ref: 'BK-1', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: true, customer_email_hash: '4f56fd90e15f2b2ce4ab9d6f5b8d2a3b9a6a3a3d4f7c0f0f8a2a3f3b0c1d2e3f' };
    if (ref === 'BK-1') return { booking_ref: 'BK-1', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: false, customer_email_hash: null };
    if (ref === 'BK-2' && token === 'good-token') return { booking_ref: 'BK-2', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: true };
    return null;
  }),
  fetchPublicVehicle: vi.fn(async (team: string, vehicle: string) => (team === 'exotiq' && vehicle === 'storefront-only' ? { name: 'Storefront Car' } : null)),
}));
vi.mock('../booking/config', async () => {
  const actual = await vi.importActual<typeof import('../booking/config')>('../booking/config');
  return { ...actual, getDataMode: () => 'supabase', siteUrl: () => 'https://test.local' };
});

import * as store from './store';
import { sendMail } from './email';
import { createHash } from 'node:crypto';
import { RateLimitedError, CaptureRefusedError, confirmByToken, handleCapture, unsubscribeByToken } from './capture';

const META = { ip: '1.2.3.4', userAgent: 'test' };
const HASH_AB = createHash('sha256').update('a@b.co').digest('hex');
import * as rpc from '../booking/rpcClient';
vi.mocked(rpc.fetchBookingByRef).mockImplementation(async (ref: string, token?: string) => {
  if (ref === 'BK-1' && token === 'good-token') return { booking_ref: 'BK-1', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: true, customer_email_hash: HASH_AB } as never;
  if (ref === 'BK-1') return { booking_ref: 'BK-1', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: false, customer_email_hash: null } as never;
  if (ref === 'BK-2' && token === 'good-token') return { booking_ref: 'BK-2', status: 'requested', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', authorized: true } as never;
  return null;
});
type S = typeof store & { __renters: Map<string, Record<string, unknown>>; __alerts: Array<Record<string, unknown>>; __emails: Array<{ kind: string }>; __events: Array<unknown>; __reset: () => void };
const S = store as unknown as S;
const row = (email: string) => S.__renters.get(email)!;
const confirmTokenFrom = () => (vi.mocked(sendMail).mock.calls.at(-1)![0] as { text: string }).text.match(/confirm\?token=([A-Za-z0-9_-]+)/)![1];

describe('handleCapture', () => {
  beforeEach(() => { S.__reset(); vi.mocked(sendMail).mockClear(); process.env.RENTERS_TOKEN_SECRET = 'test-secret'; });

  it('a footer signup records a PENDING consent and sends one confirmation; the click turns consent on', async () => {
    const out = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(out.status).toBe('confirm_sent');
    expect(row('a@b.co').marketing_consent).toBe(false);
    expect(row('a@b.co').consent_requested_at).toBeTruthy();
    expect(row('a@b.co').consent_text_version).toBe('footer-2026-09-04');
    expect(row('a@b.co').consent_ip_hash).not.toContain('1.2.3.4');
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    expect((vi.mocked(sendMail).mock.calls[0][0] as { text: string }).text).toContain('first looks');
    // A second tap inside ten minutes re-uses the pending link.
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    const token = confirmTokenFrom(); // before the click: the click itself sends the saved-list mail
    const c = await confirmByToken(token, META);
    expect(c.ok && c.marketing).toBe(true);
    expect(row('a@b.co').marketing_consent).toBe(true);
    expect(row('a@b.co').consented_at).toBeTruthy();
    expect(row('a@b.co').consent_requested_at).toBeNull();
    expect(row('a@b.co').confirmed_at).toBeTruthy();
    expect(row('a@b.co').confirm_token_hash).toBeNull();
    expect((await confirmByToken(token, META)).ok).toBe(false);
  });

  it('a stranger cannot re-subscribe an unsubscribed address: consent stays pending until that address clicks', async () => {
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    await confirmByToken(confirmTokenFrom(), META);
    const id = row('a@b.co').id as string;
    expect(await unsubscribeByToken(id, unsubscribeToken(id, 'test-secret'))).toBe(true);
    expect(row('a@b.co').marketing_consent).toBe(false);
    expect(row('a@b.co').alerts_paused_at).toBeTruthy();
    // A paused address gets at most one confirmation a day: the earlier one counts, so today's ask is a cooldown…
    expect((await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META)).status).toBe('cooldown');
    // …and tomorrow it goes out.
    S.__emails.length = 0;
    const again = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(again.status).toBe('confirm_sent');
    expect(row('a@b.co').marketing_consent).toBe(false);
    expect(row('a@b.co').unsubscribed_at).toBeTruthy();
    await confirmByToken(confirmTokenFrom(), META);
    expect(row('a@b.co').marketing_consent).toBe(true);
    expect(row('a@b.co').unsubscribed_at).toBeNull();
    expect(row('a@b.co').alerts_paused_at).toBeNull();
  });

  it('a booking counts only when the tenant DB binds it to the address; otherwise it takes the click path', async () => {
    const forged = await handleCapture({ email: 'victim@x.co', source: 'booking', consent: true, booking_ref: 'BK-9', booking_token: 'nope' }, META);
    expect(forged.status).toBe('confirm_sent'); // a pending consent request, one confirmation mail, nothing granted
    expect(row('victim@x.co').confirmed_at).toBeNull();
    expect(row('victim@x.co').marketing_consent).toBe(false);
    expect(row('victim@x.co').bookings_count).toBe(0);
    // Authorized but unbound (backend without the hash): same click path.
    const unbound = await handleCapture({ email: 'c@d.co', source: 'booking', consent: false, booking_ref: 'BK-2', booking_token: 'good-token', name: 'C' }, META);
    expect(unbound.status).toBe('recorded');
    expect(row('c@d.co').confirmed_at).toBeNull();
    expect(row('c@d.co').name).toBeNull();
    // Bound to another address: refused as proof.
    const other = await handleCapture({ email: 'e@f.co', source: 'booking', consent: true, booking_ref: 'BK-1', booking_token: 'good-token' }, META);
    expect(other.status).toBe('confirm_sent');
    expect(row('e@f.co').confirmed_at).toBeNull();
    // Bound to this address: confirmed and, with the box ticked, consented at once.
    const ok = await handleCapture({ email: 'a@b.co', source: 'booking', consent: true, booking_ref: 'BK-1', booking_token: 'good-token', name: 'G', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }, META);
    expect(ok.status).toBe('recorded');
    expect(row('a@b.co').confirmed_at).toBeTruthy();
    expect(row('a@b.co').marketing_consent).toBe(true);
    expect(row('a@b.co').consent_text_version).toBe('review-2026-09-04');
    expect(row('a@b.co').name).toBe('G');
    expect(row('a@b.co').bookings_count).toBe(1);
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-1', booking_token: 'good-token' }, META);
    expect(row('a@b.co').bookings_count).toBe(1);
  });

  it("a click applies only the scope its own mail named: a stranger's consent request never rides a list confirmation", async () => {
    // The owner asks for their list (no consent), then a stranger asks for first looks on the same address.
    await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    const ownerLink = confirmTokenFrom();
    S.__events.length = 0;
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, { ip: '6.6.6.6', userAgent: 'stranger' });
    expect(row('a@b.co').consent_requested_at).toBeTruthy();
    // The stranger's wider ask minted a NEW link naming first looks; the owner's older link is no longer live.
    const strangerLink = confirmTokenFrom();
    expect(strangerLink).not.toBe(ownerLink);
    expect((vi.mocked(sendMail).mock.calls.at(-1)![0] as { text: string }).text).toContain('first looks');
    expect((await confirmByToken(ownerLink, META)).ok).toBe(false);
    expect(row('a@b.co').marketing_consent).toBe(false);
    // Only the mail that says "first looks" can turn it on — and then the click's evidence is recorded.
    const c = await confirmByToken(strangerLink, { ip: '7.7.7.7', userAgent: 'owner' });
    expect(c.ok && c.marketing).toBe(true);
    expect(row('a@b.co').consent_user_agent).toBe('owner');
  });

  it('confirmation links expire after seven days', async () => {
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    const link = confirmTokenFrom();
    row('a@b.co').confirm_issued_at = new Date(Date.now() - 8 * 86400000).toISOString();
    expect((await confirmByToken(link, META)).ok).toBe(false);
    expect(row('a@b.co').confirm_token_hash).toBeNull();
  });

  it('saved-car names come from the catalog or the storefront read, never from the request', async () => {
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-1', booking_token: 'good-token' }, META);
    vi.mocked(store.addSavedCars).mockClear();
    await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }, { team_slug: 'exotiq', vehicle_slug: 'storefront-only' }, { team_slug: 'nobody', vehicle_slug: 'invented' }] }, META);
    const cars = vi.mocked(store.addSavedCars).mock.calls[0][1] as Array<{ vehicle_slug: string; vehicle_name: string | null }>;
    expect(cars.map((c) => [c.vehicle_slug, c.vehicle_name])).toEqual([['2017-audi-s8', 'Audi S8 Plus'], ['storefront-only', 'Storefront Car']]);
    expect((vi.mocked(sendMail).mock.calls.at(-1)![0] as { subject: string }).subject).toBe('Your saved cars on Drive Exotiq');
  });

  it('a confirmed renter asking for the list gets it once, then a cooldown', async () => {
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-1', booking_token: 'good-token' }, META);
    const first = await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    expect(first.status).toBe('delivered');
    const mail = vi.mocked(sendMail).mock.calls[0][0] as { kind: string; html: string; unsubscribeHref: string };
    expect(mail.kind).toBe('saved_list');
    expect(mail.html).toContain('Audi S8 Plus');
    expect(mail.unsubscribeHref).toContain('/api/renters/unsubscribe?r=');
    const second = await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    expect(second.status).toBe('cooldown');
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });

  it('alerts: capped at five, never duplicated, paused by unsubscribe, resumed by a click', async () => {
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-1', booking_token: 'good-token' }, META);
    const mk = (d: number) => ({ email: 'a@b.co', source: 'alert' as const, consent: false, alert: { team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', start: `2026-10-${10 + d}`, end: `2026-10-${12 + d}` } });
    expect((await handleCapture(mk(0), META)).status).toBe('delivered');
    expect((await handleCapture(mk(0), META)).status).toBe('alert_set');
    expect(S.__alerts.length).toBe(1);
    for (let d = 1; d < 5; d += 1) { S.__events.length = 0; await handleCapture(mk(d), META); }
    S.__events.length = 0;
    await expect(handleCapture(mk(7), META)).rejects.toBeInstanceOf(CaptureRefusedError);
    S.__events.length = 0;
    const id = row('a@b.co').id as string;
    await unsubscribeByToken(id, unsubscribeToken(id, 'test-secret'));
    expect(S.__alerts.every((a) => a.status === 'cancelled')).toBe(true);
    vi.mocked(sendMail).mockClear();
    S.__events.length = 0;
    const after = await handleCapture(mk(8), META);
    expect(after.status).toBe('confirm_sent');
    expect(S.__alerts.at(-1)!.status).toBe('active');
    await confirmByToken(confirmTokenFrom(), META);
    expect(row('a@b.co').alerts_paused_at).toBeNull();
    expect(row('a@b.co').marketing_consent).toBe(false);
  });

  it('rate limits by connection and by address', async () => {
    for (let i = 0; i < 30; i += 1) await store.logEvent({ kind: 'x', ip_hash: hashIp('1.2.3.4', 'test-secret') });
    await expect(handleCapture({ email: 'z@b.co', source: 'footer', consent: false }, META)).rejects.toBeInstanceOf(RateLimitedError);
    S.__reset();
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: false }, { ip: '9.9.9.9', userAgent: 'x' });
    const id = row('a@b.co').id as string;
    for (let i = 0; i < 6; i += 1) await store.logEvent({ kind: 'x', renter_id: id });
    await expect(handleCapture({ email: 'a@b.co', source: 'footer', consent: false }, { ip: '8.8.8.8', userAgent: 'x' })).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('a failed send is reported, and the next try sends again', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('resend 500'));
    const out = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(out.status).toBe('mail_failed');
    expect(row('a@b.co').confirm_sent_at).toBeNull();
    const retry = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(retry.status).toBe('confirm_sent');
    expect(row('a@b.co').confirm_sent_at).toBeTruthy();
  });
});
