import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCapture } from './validate';
import { hashIp, hashToken, looksLikeToken, newToken, safeEqual, unsubscribeToken } from './tokens';
import { decideAlerts } from './alerts';
import type { AlertRow } from './store';

const TODAY = '2026-09-04';

describe('validateCapture', () => {
  it('accepts a footer signup with consent', () => {
    const r = validateCapture({ email: ' Gregory@Example.com ', source: 'footer', consent: true }, TODAY);
    expect(r.ok && r.value.email).toBe('gregory@example.com');
    expect(r.ok && r.value.consent).toBe(true);
  });
  it('rejects the honeypot, bad e-mails, unknown sources', () => {
    expect(validateCapture({ email: 'a@b.co', source: 'footer', website: 'http://spam' }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'not-an-email', source: 'footer' }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'a@b.co', source: 'newsletter' }, TODAY).ok).toBe(false);
    expect(validateCapture('nope', TODAY).ok).toBe(false);
  });
  it('a saved list needs at least one valid car', () => {
    expect(validateCapture({ email: 'a@b.co', source: 'save_list', saved: [] }, TODAY).ok).toBe(false);
    expect(validateCapture({ email: 'a@b.co', source: 'save_list', saved: [{ team_slug: 'exotiq', vehicle_slug: 'Bad Slug' }] }, TODAY).ok).toBe(false);
    const r = validateCapture({ email: 'a@b.co', source: 'save_list', saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, TODAY);
    expect(r.ok && r.value.saved).toEqual([{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }]);
  });
  it('alerts need a real future window inside the horizon, and a car needs its operator', () => {
    const base = { email: 'a@b.co', source: 'alert' as const };
    expect(validateCapture({ ...base, alert: { start: '2026-09-10', end: '2026-09-10', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2026-09-01', end: '2026-09-03', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2027-05-01', end: '2027-05-03', team_slug: null, vehicle_slug: null } }, TODAY).ok).toBe(false);
    expect(validateCapture({ ...base, alert: { start: '2026-09-10', end: '2026-09-12', team_slug: null, vehicle_slug: 'car' } }, TODAY).ok).toBe(false);
    const r = validateCapture({ ...base, alert: { start: '2026-09-10', end: '2026-09-12', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' } }, TODAY);
    expect(r.ok && r.value.alert).toEqual({ start: '2026-09-10', end: '2026-09-12', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' });
    expect(validateCapture({ ...base }, TODAY).ok).toBe(false);
  });
  it('booking captures carry the reference and slugs', () => {
    const r = validateCapture({ email: 'a@b.co', source: 'booking', consent: true, booking_ref: 'BK-03500', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', name: 'G' }, TODAY);
    expect(r.ok && r.value.booking_ref).toBe('BK-03500');
    expect(validateCapture({ email: 'a@b.co', source: 'booking', booking_ref: 'BK 03500' }, TODAY).ok).toBe(false);
  });
});

describe('tokens', () => {
  it('mints url-safe tokens whose hashes are stable and never equal the token', () => {
    const t = newToken();
    expect(looksLikeToken(t)).toBe(true);
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(looksLikeToken('short')).toBe(false);
    expect(looksLikeToken(`${t}/../x`)).toBe(false);
  });
  it('unsubscribe tokens are derived per renter and secret', () => {
    const a = unsubscribeToken('11111111-1111-4111-8111-111111111111', 's1');
    expect(a).toBe(unsubscribeToken('11111111-1111-4111-8111-111111111111', 's1'));
    expect(a).not.toBe(unsubscribeToken('22222222-2222-4222-8222-222222222222', 's1'));
    expect(a).not.toBe(unsubscribeToken('11111111-1111-4111-8111-111111111111', 's2'));
    expect(looksLikeToken(a)).toBe(true);
    expect(safeEqual(a, a)).toBe(true);
    expect(safeEqual(a, `${a}x`)).toBe(false);
  });
  it('ip hashes are salted and short', () => {
    expect(hashIp('1.2.3.4', 'salt')).toHaveLength(32);
    expect(hashIp('1.2.3.4', 'salt')).not.toBe(hashIp('1.2.3.4', 'other'));
  });
});

function alert(over: Partial<AlertRow>): AlertRow {
  return { id: over.id ?? 'a1', renter_id: 'r1', team_slug: null, vehicle_slug: null, start_on: '2026-09-10', end_on: '2026-09-12', status: 'active', created_at: '2026-09-01T00:00:00Z', renters: { email: 'a@b.co', name: null, confirmed_at: '2026-09-01T00:00:00Z', unsubscribed_at: null }, ...over };
}

describe('decideAlerts', () => {
  const catalog = [{ team_slug: 'exotiq', vehicle_slug: 'a' }, { team_slug: 'exotiq', vehicle_slug: 'b' }, { team_slug: 'bay', vehicle_slug: 'c' }];
  it('notifies a car alert only when that car is free', () => {
    const a = alert({ team_slug: 'exotiq', vehicle_slug: 'a' });
    expect(decideAlerts([a], TODAY, catalog, new Map([[a.id, new Set(['exotiq/a'])]]))[0].action).toBe('wait');
    const d = decideAlerts([a], TODAY, catalog, new Map([[a.id, new Set(['exotiq/b'])]]))[0];
    expect(d.action).toBe('notify');
    expect(d.freeKeys).toEqual(['exotiq/a']);
  });
  it('operator and marketplace alerts list every free car in scope', () => {
    const t = alert({ id: 't', team_slug: 'exotiq' });
    const any = alert({ id: 'any' });
    const busy = new Set(['exotiq/a']);
    expect(decideAlerts([t], TODAY, catalog, new Map([[t.id, busy]]))[0].freeKeys).toEqual(['exotiq/b']);
    expect(decideAlerts([any], TODAY, catalog, new Map([[any.id, busy]]))[0].freeKeys).toEqual(['exotiq/b', 'bay/c']);
  });
  it('expires past windows, skips unconfirmed or unsubscribed renters, waits without a busy read', () => {
    expect(decideAlerts([alert({ start_on: '2026-09-01', end_on: '2026-09-03' })], TODAY, catalog, new Map())[0].action).toBe('expire');
    expect(decideAlerts([alert({ renters: { email: 'a@b.co', name: null, confirmed_at: null, unsubscribed_at: null } })], TODAY, catalog, new Map([['a1', new Set()]]))[0].action).toBe('skip');
    expect(decideAlerts([alert({ renters: { email: 'a@b.co', name: null, confirmed_at: '2026-09-01T00:00:00Z', unsubscribed_at: '2026-09-02T00:00:00Z' } })], TODAY, catalog, new Map([['a1', new Set()]]))[0].action).toBe('skip');
    expect(decideAlerts([alert({})], TODAY, catalog, new Map())[0].action).toBe('wait');
  });
});

// ---- capture orchestration, store and mail mocked ----
vi.mock('./store', () => {
  const renters = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const api = {
    __renters: renters,
    __reset: () => { renters.clear(); seq = 0; },
    findRenterByEmail: vi.fn(async (email: string) => (renters.get(email) as never) ?? null),
    findRenterById: vi.fn(async (id: string) => ([...renters.values()].find((r) => r.id === id) as never) ?? null),
    findRenterByConfirmHash: vi.fn(async (hash: string) => ([...renters.values()].find((r) => r.confirm_token_hash === hash) as never) ?? null),
    insertRenter: vi.fn(async (fields: Record<string, unknown>) => {
      const row = { id: `00000000-0000-4000-8000-00000000000${++seq}`, name: null, phone: null, marketing_consent: false, consented_at: null, consent_source: null, confirmed_at: null, confirm_token_hash: null, confirm_sent_at: null, unsubscribed_at: null, first_source: null, first_booking_ref: null, last_booking_ref: null, bookings_count: 0, created_at: 'now', ...fields };
      renters.set(fields.email as string, row);
      return row as never;
    }),
    patchRenter: vi.fn(async (id: string, fields: Record<string, unknown>) => {
      const row = [...renters.values()].find((r) => r.id === id)!;
      Object.assign(row, fields);
      return row as never;
    }),
    addSavedCars: vi.fn(async () => undefined),
    listSavedCars: vi.fn(async () => [{ renter_id: 'x', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8', vehicle_name: 'Audi S8 Plus', saved_at: 'now' }]),
    addAlert: vi.fn(async () => ({}) as never),
    cancelAlertsForRenter: vi.fn(async () => undefined),
    logEvent: vi.fn(async () => undefined),
    logEmail: vi.fn(async () => undefined),
  };
  return api;
});
vi.mock('./email', async () => {
  const actual = await vi.importActual<typeof import('./email')>('./email');
  return { ...actual, sendMail: vi.fn(async () => ({ id: 'mail-1' })) };
});
vi.mock('../booking/service', () => ({
  getMarketplaceListings: vi.fn(async () => ({ listings: [{ team: { slug: 'exotiq', name: 'Exotiq', city: 'Scottsdale' }, vehicle: { slug: '2017-audi-s8', name: 'Audi S8 Plus', dailyRateCents: 200 }, photoCount: 1 }], totalCount: 1 })),
}));

import * as store from './store';
import { sendMail } from './email';
import { confirmByToken, handleCapture, unsubscribeByToken } from './capture';

const META = { ip: '1.2.3.4', userAgent: 'test' };

describe('handleCapture', () => {
  beforeEach(() => {
    (store as unknown as { __reset: () => void }).__reset();
    vi.mocked(sendMail).mockClear();
    process.env.RENTERS_TOKEN_SECRET = 'test-secret';
  });
  it('a new footer signup is recorded with dated consent and gets one confirmation e-mail', async () => {
    const out = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(out.status).toBe('confirm_sent');
    const row = (store as unknown as { __renters: Map<string, Record<string, unknown>> }).__renters.get('a@b.co')!;
    expect(row.marketing_consent).toBe(true);
    expect(row.consent_source).toBe('footer');
    expect(typeof row.consented_at).toBe('string');
    expect(row.consent_ip_hash).not.toContain('1.2.3.4');
    expect(row.confirm_token_hash).toHaveLength(64);
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMail).mock.calls[0][0].kind).toBe('confirm');
    // A second tap within ten minutes re-uses the pending link instead of sending another.
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });
  it('a later request without consent never turns consent off; consent after unsubscribe turns it back on', async () => {
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    const renters = (store as unknown as { __renters: Map<string, Record<string, unknown>> }).__renters;
    expect(renters.get('a@b.co')!.marketing_consent).toBe(true);
    renters.get('a@b.co')!.unsubscribed_at = 'earlier';
    renters.get('a@b.co')!.marketing_consent = false;
    await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    expect(renters.get('a@b.co')!.marketing_consent).toBe(true);
    expect(renters.get('a@b.co')!.unsubscribed_at).toBeNull();
  });
  it('a booking counts as a confirmed address and records the reference; nothing is mailed', async () => {
    const out = await handleCapture({ email: 'a@b.co', source: 'booking', consent: true, booking_ref: 'BK-1', name: 'G', team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }, META);
    expect(out.status).toBe('recorded');
    const row = (store as unknown as { __renters: Map<string, Record<string, unknown>> }).__renters.get('a@b.co')!;
    expect(row.confirmed_at).toBeTruthy();
    expect(row.first_booking_ref).toBe('BK-1');
    expect(row.bookings_count).toBe(1);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-2' }, META);
    expect(row.bookings_count).toBe(2);
    expect(row.last_booking_ref).toBe('BK-2');
  });
  it('a confirmed renter asking for the list gets it immediately, with catalog names and prices', async () => {
    await handleCapture({ email: 'a@b.co', source: 'booking', consent: false, booking_ref: 'BK-1' }, META);
    const out = await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    expect(out.status).toBe('delivered');
    const mail = vi.mocked(sendMail).mock.calls[0][0];
    expect(mail.kind).toBe('saved_list');
    expect(mail.html).toContain('Audi S8 Plus');
    expect(mail.html).toContain('$2 per day');
    expect(mail.html).toContain('/api/renters/unsubscribe?r=');
  });
  it('the confirmation link works once, then delivers the pending list', async () => {
    await handleCapture({ email: 'a@b.co', source: 'save_list', consent: false, saved: [{ team_slug: 'exotiq', vehicle_slug: '2017-audi-s8' }] }, META);
    const confirmHref = vi.mocked(sendMail).mock.calls[0][0].text.match(/confirm\?token=([A-Za-z0-9_-]+)/)![1];
    const first = await confirmByToken(confirmHref);
    expect(first.ok && first.delivered).toBe('saved_list');
    expect(vi.mocked(sendMail).mock.calls[1][0].kind).toBe('saved_list');
    expect((await confirmByToken(confirmHref)).ok).toBe(false);
  });
  it('unsubscribe needs the derived token for that renter and cancels alerts', async () => {
    const out = await handleCapture({ email: 'a@b.co', source: 'footer', consent: true }, META);
    const { unsubscribeToken } = await import('./tokens');
    expect(await unsubscribeByToken(out.renterId, 'not-the-token-not-the-token-not-the-tok')).toBe(false);
    expect(await unsubscribeByToken(out.renterId, unsubscribeToken(out.renterId, 'test-secret'))).toBe(true);
    const row = (store as unknown as { __renters: Map<string, Record<string, unknown>> }).__renters.get('a@b.co')!;
    expect(row.marketing_consent).toBe(false);
    expect(store.cancelAlertsForRenter).toHaveBeenCalledWith(out.renterId);
  });
});
