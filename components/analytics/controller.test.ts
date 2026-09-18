import { describe, expect, it, vi } from 'vitest';
import { createTracker, type TrackerDependencies, type AnalyticsClient } from './controller';
import { consentValue } from './policy';

const enabled = { enabled: 'true', dataMode: 'supabase', posthogKey: 'phc_publicTest123', metaPixelId: '1603562574756003' };
const consent = (analytics = false, marketing = false) => ({ analytics, marketing });
function harness(initial = consent(), overrides: Partial<TrackerDependencies> = {}) {
  let location = { hostname: 'book.exotiq.rent', pathname: '/exotiq', href: 'https://book.exotiq.rent/exotiq', referrer: '' };
  const ph = { capture: vi.fn(), stop: vi.fn() };
  const meta = { capture: vi.fn(), stop: vi.fn() };
  const deps: TrackerDependencies = { location: () => location, readConsent: () => initial, saveConsent: vi.fn(), gpc: () => false, loadPostHog: vi.fn(async () => ph), loadMeta: vi.fn(async () => meta), clearIdentifiers: vi.fn(), reload: vi.fn(), attribution: vi.fn(() => ({})), ...overrides };
  const tracker = createTracker(enabled, deps);
  return { tracker, deps, ph, meta, go(path: string) { location = { ...location, pathname: path.split('?')[0], href: `https://book.exotiq.rent${path}` }; tracker.navigate(); } };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('consented tracking lifecycle', () => {
  it('never loads SDKs or replays interactions before explicit consent, but grants current page + semantic view', async () => {
    const h = harness();
    h.tracker.navigate(); h.tracker.track('book_step', { step: 2 });
    expect(h.deps.loadPostHog).not.toHaveBeenCalled(); expect(h.deps.loadMeta).not.toHaveBeenCalled();
    h.go('/exotiq/huracan'); h.tracker.track('vehicle_view', { team: 'exotiq', vehicle: 'huracan' });
    h.tracker.choose(consent(true, true)); await settle();
    expect(h.ph.capture.mock.calls.map(([name]) => name)).toEqual(['$pageview', 'vehicle_view']);
    expect(h.meta.capture.mock.calls.map(([name]) => name)).toEqual(['PageView', 'ViewContent']);
    expect(h.meta.capture.mock.calls[1][1]).toMatchObject({ content_ids: ['exotiq/huracan'], content_type: 'product' });
  });
  it('keeps permissions independent; tracks each channel once per meaningful navigation including back', async () => {
    const h = harness(consent(true, false));
    h.tracker.navigate(); h.tracker.navigate(); await settle();
    expect(h.ph.capture.mock.calls.map(([name]) => name)).toEqual(['$pageview', 'storefront_view']);
    expect(h.deps.loadMeta).not.toHaveBeenCalled();
    h.tracker.choose(consent(true, true)); await settle();
    expect(h.ph.capture).toHaveBeenCalledTimes(2); expect(h.meta.capture).toHaveBeenCalledTimes(1);
    h.go('/exotiq?utm_source=facebook'); h.go('/exotiq/huracan');
    h.tracker.track('vehicle_view', { team: 'exotiq', vehicle: 'huracan' }); h.tracker.navigate(); await settle();
    expect(h.ph.capture.mock.calls.map(([name]) => name)).toEqual(['$pageview', 'storefront_view', '$pageview', 'vehicle_view']);
    h.go('/exotiq'); await settle();
    expect(h.ph.capture.mock.calls.filter(([name]) => name === '$pageview')).toHaveLength(3);
    const onlyMeta = harness(consent(false, true)); onlyMeta.tracker.navigate(); await settle();
    expect(onlyMeta.deps.loadPostHog).not.toHaveBeenCalled(); expect(onlyMeta.meta.capture).toHaveBeenCalledTimes(1);
  });
  it('honors GPC even with a persisted marketing grant', async () => {
    const h = harness(consent(true, true), { gpc: () => true }); h.tracker.navigate(); await settle();
    expect(h.deps.loadMeta).not.toHaveBeenCalled(); expect(h.ph.capture).toHaveBeenCalled();
  });
  it('queues permitted events during init, then rechecks consent and discards everything after revocation', async () => {
    let resolve!: (value: AnalyticsClient) => void;
    const h = harness(consent(true), { loadPostHog: vi.fn(() => new Promise<AnalyticsClient>(r => { resolve = r; })) });
    h.tracker.navigate(); h.tracker.track('book_step', { step: 2 });
    h.tracker.choose(consent()); resolve(h.ph); await settle();
    expect(h.ph.capture).not.toHaveBeenCalled(); expect(h.ph.stop).toHaveBeenCalled();
    expect(h.deps.clearIdentifiers).toHaveBeenCalled(); expect(h.deps.reload).toHaveBeenCalledTimes(1);
  });
  it('full reloads and stops SDKs on private/other-tenant SPA transitions, also blocks stale before_send', async () => {
    for (const path of ['/booking/BK-private', '/verify', '/saved', '/renters/saved', '/other/huracan', '/exotiq?token=PRIVATE', '/exotiq?T=PRIVATE', '/exotiq?r=PRIVATE']) {
      const h = harness(consent(true, true)); h.tracker.navigate(); await settle();
      const before = h.ph.capture.mock.calls.length; h.go(path); h.tracker.track('checkout_started', {}); await settle();
      expect(h.deps.reload).toHaveBeenCalledTimes(1); expect(h.ph.stop).toHaveBeenCalled(); expect(h.meta.stop).toHaveBeenCalled();
      expect(h.ph.capture).toHaveBeenCalledTimes(before);
      expect(h.tracker.canSend('analytics')).toBe(false);
    }
    const h = harness(consent(true, true)); h.go('/booking/BK-private'); await settle();
    expect(h.deps.loadPostHog).not.toHaveBeenCalled(); expect(h.deps.loadMeta).not.toHaveBeenCalled(); expect(h.deps.reload).not.toHaveBeenCalled();
  });
  it('does not break booking when SDK load or capture fails', async () => {
    const h = harness(consent(true, true), { loadPostHog: vi.fn(async () => { throw Error('blocked'); }), loadMeta: vi.fn(async () => ({ capture() { throw Error('offline'); }, stop() {} })) });
    expect(() => h.tracker.navigate()).not.toThrow(); await settle(); expect(() => h.tracker.track('booking_created', {})).not.toThrow(); await settle();
  });
  it('sends deduplicated Lead only for a successful booking event with opaque logical event ID, never Purchase', async () => {
    const h = harness(consent(true, true)); h.tracker.navigate(); await settle();
    const props = { team: 'exotiq', vehicle: 'huracan', event_id: 'booking_created_00000000-1234-4000-8000-000000000001', booking: 'BK-secret', email: 'renter@example.com' };
    h.tracker.track('booking_created', props); h.tracker.track('booking_created', props);
    h.tracker.track('booking_created', { booking: 'BK-no-opaque-id' }); h.tracker.track('Purchase', { value: 200 }); await settle();
    const leads = h.meta.capture.mock.calls.filter(([name]) => name === 'Lead');
    expect(leads).toHaveLength(1); expect(leads[0][2]).toBe(props.event_id);
    expect(h.ph.capture.mock.calls.filter(([name]) => name === 'booking_created')).toHaveLength(1);
    expect(JSON.stringify([h.ph.capture.mock.calls, h.meta.capture.mock.calls])).not.toMatch(/BK-|renter|Purchase/);
  });
  it('synchronizes repeated external grants and withdrawals without saving, while local choices still save', async () => {
    const h = harness();
    h.tracker.syncConsent(consent(true, true)); h.tracker.syncConsent(consent(true, true)); await settle();
    expect(h.tracker.consent()).toEqual(consent(true, true));
    expect(h.ph.capture).toHaveBeenCalledTimes(2); expect(h.meta.capture).toHaveBeenCalledTimes(1);
    h.tracker.syncConsent(consent()); h.tracker.syncConsent(consent()); await settle();
    expect(h.tracker.consent()).toEqual(consent());
    expect(h.deps.saveConsent).not.toHaveBeenCalled(); expect(h.deps.reload).toHaveBeenCalledTimes(1);
    expect(h.ph.stop).toHaveBeenCalledTimes(1); expect(h.meta.stop).toHaveBeenCalledTimes(1);
    const local = harness(); local.tracker.choose(consent(true));
    expect(local.deps.saveConsent).toHaveBeenCalledExactlyOnceWith(consent(true));
  });
  it.each(['analytics', 'marketing'] as const)('discards the late %s queue after an external withdrawal', async channel => {
    let resolve!: (value: AnalyticsClient) => void;
    const load = vi.fn(() => new Promise<AnalyticsClient>(r => { resolve = r; }));
    const h = harness(consent(), channel === 'analytics' ? { loadPostHog: load } : { loadMeta: load });
    h.tracker.syncConsent(consent(channel === 'analytics', channel === 'marketing'));
    h.tracker.track('book_step', { step: 2 });
    h.tracker.syncConsent(consent()); resolve(h.ph); await settle();
    expect(h.ph.capture).not.toHaveBeenCalled(); expect(h.ph.stop).toHaveBeenCalledTimes(1);
    expect(h.tracker.canSend(channel)).toBe(false); expect(h.deps.saveConsent).not.toHaveBeenCalled();
    expect(h.deps.clearIdentifiers).toHaveBeenCalledTimes(1); expect(h.deps.reload).toHaveBeenCalledTimes(1);
  });
  it('consent storage parsing remains fail closed while current-document choices can be in memory', async () => {
    const h = harness(consentValue(null, false), { saveConsent() { throw Error('storage unavailable'); } });
    expect(() => h.tracker.choose(consent(true))).not.toThrow(); await settle();
    expect(h.ph.capture).toHaveBeenCalled();
  });
});
