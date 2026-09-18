import { describe, expect, it } from 'vitest';
import { eligibleRoute, trackingConfig, sanitizeProperties, sanitizeUrl, sanitizePostHogEvent, consentValue } from './policy';

const env = { enabled: 'true', dataMode: 'supabase', posthogKey: 'phc_publicTest123', posthogHost: 'https://us.i.posthog.com', metaPixelId: '1603562574756003' };

describe('production allowlist', () => {
  it('allows only approved live host, tenant and public storefront/vehicle/book routes', () => {
    expect(trackingConfig(env, 'book.exotiq.rent', '/exotiq')).toMatchObject({ eligible: true, posthogKey: env.posthogKey, metaPixelId: env.metaPixelId });
    for (const path of ['/exotiq', '/exotiq/', '/exotiq/lamborghini-huracan', '/exotiq/lamborghini-huracan/book']) expect(eligibleRoute(path)).toBe(true);
    for (const path of ['/', '/other', '/other/car', '/exotiq-evil/car', '/booking/BK-secret', '/verify', '/saved', '/renters/saved', '/exotiq/car/extra', '/exotiq/car?token=secret', '/exotiq/%65mail']) expect(eligibleRoute(path)).toBe(false);
    for (const hostname of ['localhost', 'demo.exotiq.rent', 'exotiq.rent', 'preview.netlify.app', 'book.exotiq.rent.evil.test']) expect(trackingConfig(env, hostname, '/exotiq').eligible).toBe(false);
    expect(trackingConfig({ ...env, enabled: undefined }, 'book.exotiq.rent', '/exotiq').eligible).toBe(false);
    expect(trackingConfig({ ...env, dataMode: 'mock' }, 'book.exotiq.rent', '/exotiq').eligible).toBe(false);
  });
  it('never exposes missing or secret keys; Meta works independently; only official ingestion hosts', () => {
    for (const key of [undefined, '', 'phs_SECRET', 'phx_SECRET', 'phc_<script>']) expect(trackingConfig({ ...env, posthogKey: key }, 'book.exotiq.rent', '/exotiq').posthogKey).toBe('');
    expect(trackingConfig({ ...env, posthogKey: '' }, 'book.exotiq.rent', '/exotiq').metaPixelId).toBe(env.metaPixelId);
    expect(trackingConfig({ ...env, posthogHost: 'https://evil.test' }, 'book.exotiq.rent', '/exotiq').posthogKey).toBe('');
    expect(trackingConfig({ ...env, posthogHost: 'https://eu.i.posthog.com' }, 'book.exotiq.rent', '/exotiq').posthogHost).toBe('https://eu.i.posthog.com');
    expect(trackingConfig({ ...env, metaPixelId: '<secret>' }, 'book.exotiq.rent', '/exotiq').metaPixelId).toBe('');
  });
});

describe('explicit consent and GPC', () => {
  it('fails closed for missing/malformed/versionless choices and blocks marketing under GPC', () => {
    for (const value of [null, {}, { analytics: true, marketing: true }, { version: 1, analytics: 'true', marketing: 1 }]) expect(consentValue(value, false)).toEqual({ analytics: false, marketing: false });
    expect(consentValue({ version: 1, analytics: true, marketing: true }, true)).toEqual({ analytics: true, marketing: false });
    expect(consentValue({ version: 1, analytics: false, marketing: true }, false)).toEqual({ analytics: false, marketing: true });
  });
});

describe('allowlisted events only, with no identity or credential properties', () => {
  it('drops raw queries, private refs, arbitrary strings, nested values and PII', () => {
    expect(sanitizeProperties('vehicle_view', { team: 'exotiq', vehicle: 'huracan', path: '/exotiq/huracan', email: 'renter@example.com', query: '?t=SECRET', booking: 'BK-PRIVATE', nested: { token: 'SECRET' }, $set: { email: 'renter@example.com' } })).toEqual({ team: 'exotiq', vehicle: 'huracan', path: '/exotiq/huracan' });
    expect(sanitizeProperties('book_step', { step: 2, team: 'other', vehicle: 'renter@example.com', status: 'SECRET', amount: 99 })).toEqual({ step: 2 });
    expect(sanitizeProperties('booking_request_failed', { reason: 'network', error: 'renter@example.com' })).toEqual({ reason: 'network' });
    expect(sanitizeProperties('Purchase', { value: 1 })).toBeNull();
  });
  it('strips every query/hash and strips private/external paths entirely', () => {
    expect(sanitizeUrl('https://book.exotiq.rent/exotiq/huracan?t=SECRET&email=x%40x.com#token')).toBe('https://book.exotiq.rent/exotiq/huracan');
    expect(sanitizeUrl('https://book.exotiq.rent/booking/BK-PRIVATE?t=SECRET')).toBe('https://book.exotiq.rent/');
    expect(sanitizeUrl('https://elsewhere.test/users/renter@example.com?token=SECRET')).toBe('https://elsewhere.test/');
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
  });
  it('rebuilds SDK payloads instead of retaining automatic person/initial-url data', () => {
    const clean = sanitizePostHogEvent({ event: 'vehicle_view', properties: { team: 'exotiq', vehicle: 'huracan', distinct_id: '01900000-1234-7777-8888-0123456789ab', $current_url: 'https://book.exotiq.rent/exotiq/huracan?token=SECRET', $referrer: 'https://book.exotiq.rent/verify?token=SECRET', $initial_current_url: 'https://x/?token=SECRET', email: 'renter@example.com', nested: { token: 'SECRET' }, $set_once: { $initial_referrer: 'SECRET' } }, $set: { email: 'renter@example.com' } });
    expect(clean?.properties.$current_url).toBe('https://book.exotiq.rent/exotiq/huracan');
    expect(clean?.properties.$referrer).toBe('https://book.exotiq.rent/');
    expect(clean?.properties.distinct_id).toBe('01900000-1234-7777-8888-0123456789ab');
    expect(JSON.stringify(clean)).not.toMatch(/SECRET|renter|initial|\$set|nested/);
    expect(sanitizePostHogEvent({ event: '$autocapture', properties: {} })).toBeNull();
    expect(sanitizePostHogEvent(null)).toBeNull();
  });
});
