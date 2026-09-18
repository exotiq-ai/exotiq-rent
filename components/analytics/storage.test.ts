import { describe, expect, it, vi } from 'vitest';
import { readChoice, saveChoice, captureAttribution, clearTrackingStorage, CONSENT_KEY, ATTRIBUTION_KEY } from './storage';
import { sanitizePostHogEvent } from './policy';
function memory() { const m = new Map<string, string>(); return { get length() { return m.size; }, key: (i: number) => Array.from(m.keys())[i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; }

describe('consent and scoped storage', () => {
  it('defaults to denied, expires choices and safely tolerates blocked storage', () => {
    const store = memory(); expect(readChoice(store, false, 1000)).toBeNull();
    saveChoice(store, { analytics: true, marketing: true }, 1000);
    expect(readChoice(store, false, 1001)).toEqual({ analytics: true, marketing: true });
    expect(readChoice(store, true, 1001)).toEqual({ analytics: true, marketing: false });
    expect(readChoice(store, false, 1000 + 181 * 86400000)).toBeNull();
    store.setItem(CONSENT_KEY, '{garbage'); expect(readChoice(store, false)).toBeNull();
    const broken = { ...store, getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    expect(readChoice(broken, false)).toBeNull(); expect(() => saveChoice(broken, { analytics: true, marketing: false })).not.toThrow();
  });
  it('removes only this project identifiers and attribution, not renter/application storage or consent', () => {
    const store = memory(); for (const key of [CONSENT_KEY, ATTRIBUTION_KEY, 'ph_phc_test_posthog', 'ph_phc_test_posthog_session', 'ph_phc_other_posthog', 'renter_saved']) store.setItem(key, 'x');
    clearTrackingStorage(store, 'phc_test');
    expect(store.getItem(ATTRIBUTION_KEY)).toBeNull(); expect(store.getItem('ph_phc_test_posthog')).toBeNull(); expect(store.getItem('ph_phc_test_posthog_session')).toBeNull();
    expect(store.getItem(CONSENT_KEY)).toBe('x'); expect(store.getItem('renter_saved')).toBe('x'); expect(store.getItem('ph_phc_other_posthog')).toBe('x');
  });
});
describe('consented attribution allowlist', () => {
  it('records first touch and last non-direct without unknown parameters, email, tokens or raw URLs', () => {
    const store = memory();
    const first = captureAttribution(store, '?utm_source=facebook&utm_campaign=spring-drive&campaign_id=123&email=a%40b.com&fbclid=SECRET&utm_content=renter%40example.com&utm_term=phs_SECRET', 1000);
    expect(first).toMatchObject({ first_utm_source: 'facebook', last_utm_source: 'facebook', first_campaign_id: '123' });
    expect(JSON.stringify(first)).not.toMatch(/SECRET|email|renter|fbclid|utm_content|utm_term/);
    const direct = captureAttribution(store, '', 2000); expect(direct).toEqual(first);
    const next = captureAttribution(store, '?utm_source=google&ad_id=456&placement=feed', 3000);
    expect(next).toMatchObject({ first_utm_source: 'facebook', last_utm_source: 'google', last_ad_id: '456' });
    expect(next.last_campaign_id).toBeUndefined();
    expect(captureAttribution(store, '', 1000 + 31 * 86400000)).toEqual({});
  });
  it('revalidates stored attribution and final SDK properties instead of trusting stored JSON', () => {
    const store = memory(); store.setItem(ATTRIBUTION_KEY, JSON.stringify({ at: 1000, first: { utm_source: 'facebook', utm_term: 'token-SECRET', email: 'x@y.com' }, last: { utm_source: 'google' } }));
    const props = captureAttribution(store, '', 1001);
    expect(props).toEqual({ first_utm_source: 'facebook', last_utm_source: 'google' });
    const out = sanitizePostHogEvent({ event: '$pageview', properties: { ...props, last_utm_term: 'x@y.com' } });
    expect(out?.properties.first_utm_source).toBe('facebook'); expect(out?.properties.last_utm_term).toBeUndefined();
  });
});
