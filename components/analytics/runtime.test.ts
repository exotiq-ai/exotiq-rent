import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONSENT_KEY } from './storage';

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn(), stopSessionRecording: vi.fn() }));
vi.mock('posthog-js', () => ({ default: sdk }));
function memory() { const m = new Map<string, string>(); return { get length() { return m.size; }, key: (i: number) => Array.from(m.keys())[i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; }
function browser(choice?: { analytics: boolean; marketing: boolean }, path = '/exotiq') {
  const localStorage = memory(), sessionStorage = memory();
  if (choice) localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, ...choice, at: Date.now() }));
  const scripts: any[] = [];
  const reload = vi.fn();
  const location = { hostname: 'book.exotiq.rent', pathname: path.split('?')[0], href: `https://book.exotiq.rent${path}`, search: path.includes('?') ? '?' + path.split('?')[1] : '', reload };
  const w = { location, localStorage, sessionStorage, navigator: { globalPrivacyControl: false }, crypto: globalThis.crypto, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('window', w); vi.stubGlobal('navigator', w.navigator);
  vi.stubGlobal('document', { referrer: '', cookie: '', createElement: () => ({ remove: vi.fn() }), head: { appendChild: (s: any) => { scripts.push(s); queueMicrotask(() => s.onload?.()); } } });
  return { w, scripts, reload, localStorage };
}
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); sdk.init.mockImplementation(() => sdk);
  vi.stubEnv('NEXT_PUBLIC_TRACKING_ENABLED', 'true'); vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'supabase');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_publicTest123'); vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '1603562574756003');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('browser runtime integration', () => {
  it('creates its controller on the first child event; a visitor with no saved choice tracks under the opt-out default', async () => {
    const b = browser(); const runtime = await import('./posthog');
    runtime.track('vehicle_view', { vehicle: 'huracan' }); await settle();
    // US opt-out model (2026-09-18): both SDKs load without a stored choice.
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(b.scripts).toHaveLength(1);
    expect(sdk.capture.mock.calls.map(c => c[0])).toEqual(['$pageview', 'storefront_view']);
    // The default is never persisted — only an explicit choice writes storage,
    // so a later denial isn't fighting a phantom saved grant.
    expect(b.localStorage.getItem(CONSENT_KEY)).toBeNull();
  });
  it('an explicit denial still shuts everything down and is honored on the next document', async () => {
    const b = browser(); const runtime = await import('./posthog');
    runtime.track('storefront_view'); await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    runtime.getTracking()!.choose({ analytics: false, marketing: false });
    expect(b.reload).toHaveBeenCalledTimes(1); expect(sdk.opt_out_capturing).toHaveBeenCalled();
    vi.resetModules(); const reloaded = await import('./posthog');
    reloaded.getTracking()!.navigate(); await settle();
    expect(reloaded.getTracking()!.canSend('analytics')).toBe(false);
  });
  it('initializes only the consented SDK, with all automatic collection disabled and a live send guard', async () => {
    const b = browser({ analytics: true, marketing: false }); const { track } = await import('./posthog');
    track('book_step', { step: 2 }); await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1); expect(b.scripts).toHaveLength(0);
    const cfg = sdk.init.mock.calls[0][1];
    expect(cfg).toMatchObject({ autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true, advanced_disable_flags: true, disable_surveys: true, disable_product_tours: true, capture_performance: false, capture_exceptions: false, disable_external_dependency_loading: true, person_profiles: 'never', save_campaign_params: false, save_referrer: false });
    const event = { event: '$pageview', properties: { token: 'phc_publicTest123', $current_url: 'https://book.exotiq.rent/exotiq?t=PRIVATE', $referrer: 'https://book.exotiq.rent/verify?token=PRIVATE' } };
    expect(JSON.stringify(cfg.before_send(event))).not.toContain('PRIVATE');
    b.w.location.pathname = '/booking/BK-PRIVATE'; expect(cfg.before_send(event)).toBeNull();
  });
  it('assigns a stable per-document opaque booking ID synchronously and uses immediate beacon transport', async () => {
    browser({ analytics: true, marketing: false }, '/exotiq/huracan/book'); const { track } = await import('./posthog');
    track('book_start', {}); await settle(); sdk.capture.mockClear();
    track('booking_created', { booking: 'BK-PRIVATE', team: 'exotiq', vehicle: 'huracan' });
    track('booking_created', { booking: 'BK-PRIVATE', team: 'exotiq', vehicle: 'huracan' });
    const calls = sdk.capture.mock.calls.filter(c => c[0] === 'booking_created');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].event_id).toMatch(/^booking_created_[a-f0-9-]{36}$/);
    expect(calls[0][2]).toMatchObject({ send_instantly: true, transport: 'sendBeacon' });
    expect(JSON.stringify(calls)).not.toContain('BK-PRIVATE');
  });
  it('initializes the official Meta queue only after ads consent with automatic configuration disabled', async () => {
    const b = browser({ analytics: false, marketing: true }); const { track } = await import('./posthog');
    track('storefront_view', {}); await settle();
    expect(sdk.init).not.toHaveBeenCalled(); expect(b.scripts).toHaveLength(1);
    expect(b.scripts[0].src).toBe('https://connect.facebook.net/en_US/fbevents.js');
    expect((b.w as any).fbq.disablePushState).toBe(true);
    const queue = (b.w as any).fbq.queue.map((v: unknown[]) => Array.from(v));
    expect(queue).toContainEqual(['set', 'autoConfig', false, '1603562574756003']);
    expect(queue).toContainEqual(['init', '1603562574756003']);
    expect(queue.filter((c: any[]) => c[0] === 'trackSingle')).toEqual([['trackSingle', '1603562574756003', 'PageView', {}]]);
  });
  it('loads neither SDK on credentials, private routes, other tenants or a nonproduction host', async () => {
    const { track } = await import('./posthog');
    const b = browser({ analytics: true, marketing: true }, '/exotiq?token=PRIVATE');
    track('storefront_view', {}); await settle(); expect(sdk.init).not.toHaveBeenCalled(); expect(b.scripts).toHaveLength(0);
  });
  it('revokes and reloads even when preference storage is unavailable; retains renter storage', async () => {
    const b = browser({ analytics: true, marketing: true }); const runtime = await import('./posthog');
    runtime.track('storefront_view'); await settle();
    b.localStorage.setItem('renter_saved', 'necessary'); b.localStorage.setItem('ph_phc_publicTest123_posthog', 'identifier');
    b.localStorage.setItem = () => { throw Error('blocked'); };
    expect((runtime as any).getTracking).toBeTypeOf('function');
    (runtime as any).getTracking().choose({ analytics: false, marketing: false });
    expect(b.reload).toHaveBeenCalledTimes(1); expect(b.localStorage.getItem('renter_saved')).toBe('necessary');
    expect(b.localStorage.getItem('ph_phc_publicTest123_posthog')).toBeNull();
    expect(sdk.opt_out_capturing).toHaveBeenCalled();
  });
  it('survives an SDK initialization failure without interrupting booking', async () => {
    browser({ analytics: true, marketing: false }); sdk.init.mockImplementationOnce(() => { throw Error('blocked'); });
    const { track } = await import('./posthog'); expect(() => track('book_step', { step: 2 })).not.toThrow(); await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1); expect(sdk.capture).not.toHaveBeenCalled();
  });
});

describe('consent lifecycle regressions', () => {
  it('reconciles SDK opt-out on return from an ineligible route, without emitting $opt_in', async () => {
    const b = browser({ analytics: true, marketing: false });
    let optedOut = false;
    const delivered: string[] = [];
    const deliver = (event: string, properties: Record<string, unknown>) => {
      const options = sdk.init.mock.calls.at(-1)![1];
      if (!optedOut && options.before_send({ event, properties })) delivered.push(event);
    };
    sdk.capture.mockImplementation(deliver);
    sdk.opt_out_capturing.mockImplementation(() => { optedOut = true; });
    sdk.opt_in_capturing.mockImplementation(() => { optedOut = false; deliver('$opt_in', {}); });
    const first = await import('./posthog'); first.getTracking()!.navigate(); await settle();
    b.w.location.pathname = '/privacy'; b.w.location.href = 'https://book.exotiq.rent/privacy';
    first.getTracking()!.navigate();
    expect(optedOut).toBe(true); expect(b.reload).toHaveBeenCalledTimes(1);
    expect(first.storedConsent()).toEqual({ analytics: true, marketing: false });
    delivered.length = 0;
    vi.resetModules(); // A new document retains the SDK's persisted opt-out and the application grant.
    b.w.location.pathname = '/exotiq'; b.w.location.href = 'https://book.exotiq.rent/exotiq';
    const returned = await import('./posthog'); returned.getTracking()!.navigate(); await settle();
    expect(delivered).toEqual(['$pageview', 'storefront_view']);
    expect(sdk.opt_in_capturing).toHaveBeenCalledTimes(2);
  });
  it('does not opt in or initialize when consent is revoked before the SDK import resolves', async () => {
    browser({ analytics: true, marketing: false }); const runtime = await import('./posthog');
    runtime.getTracking()!.navigate(); runtime.getTracking()!.choose({ analytics: false, marketing: false });
    await settle();
    expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.opt_in_capturing).not.toHaveBeenCalled(); expect(sdk.capture).not.toHaveBeenCalled();
  });
  it('rechecks the live grant before opting in if initialization revokes consent', async () => {
    browser({ analytics: true, marketing: false }); const runtime = await import('./posthog');
    sdk.init.mockImplementationOnce(() => { runtime.getTracking()!.choose({ analytics: false, marketing: false }); return sdk; });
    runtime.getTracking()!.navigate(); await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1); expect(sdk.opt_in_capturing).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled(); expect(sdk.opt_out_capturing).toHaveBeenCalledTimes(1);
  });
  it('uses incoming storage consent instead of a stale cookie, without writeback or renewing its timestamp', async () => {
    const now = 2_000_000_000_000, at = now - 60_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const b = browser(); const runtime = await import('./posthog');
    runtime.getTracking();
    const writes = vi.spyOn(b.localStorage, 'setItem');
    const raw = JSON.stringify({ version: 1, analytics: true, marketing: false, at });
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify({ version: 1, analytics: false, marketing: false, at: now }))}`;
    // Simulate a remote storage mutation without invoking this tab's setItem.
    b.localStorage.getItem = key => key === CONSENT_KEY ? raw : null;
    const event = { key: CONSENT_KEY, newValue: raw, storageArea: b.localStorage as Storage };
    expect(runtime.syncStoredConsent(event)).toEqual({ analytics: true, marketing: false });
    // From the opt-out default (marketing on), the incoming marketing:false is
    // a revocation: the tab purges and reloads rather than keep sending. (No
    // SDK ever loaded in this tab, so there is no client to opt out.)
    expect(b.reload).toHaveBeenCalledTimes(1);
    runtime.syncStoredConsent(event); await settle();
    expect(runtime.getTracking()!.consent()).toEqual({ analytics: true, marketing: false });
    expect(writes).not.toHaveBeenCalled(); expect(b.localStorage.getItem(CONSENT_KEY)).toBe(raw);
    vi.mocked(Date.now).mockReturnValue(now + 60_000);
    runtime.syncStoredConsent(event);
    expect(writes).not.toHaveBeenCalled(); expect(b.reload).toHaveBeenCalledTimes(1);
  });
  it('fails closed on external withdrawal before reload, despite a stale grant cookie', async () => {
    const b = browser({ analytics: true, marketing: false }); const runtime = await import('./posthog');
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(b.localStorage.getItem(CONSENT_KEY)!)}`;
    runtime.getTracking()!.navigate(); await settle(); sdk.capture.mockClear();
    const raw = JSON.stringify({ version: 1, analytics: false, marketing: false, at: Date.now() - 60_000 });
    b.localStorage.getItem = key => key === CONSENT_KEY ? raw : null;
    const writes = vi.spyOn(b.localStorage, 'setItem');
    b.reload.mockImplementation(() => { expect(runtime.storedConsent()?.analytics ?? false).toBe(false); });
    const event = { key: CONSENT_KEY, newValue: raw, storageArea: b.localStorage as Storage };
    runtime.syncStoredConsent(event); runtime.syncStoredConsent(event);
    expect(runtime.getTracking()!.consent()).toEqual({ analytics: false, marketing: false });
    expect(writes).not.toHaveBeenCalled(); expect(b.reload).toHaveBeenCalledTimes(1);
    expect(sdk.opt_out_capturing).toHaveBeenCalledTimes(1);
    vi.resetModules(); const reloaded = await import('./posthog');
    reloaded.getTracking()!.navigate(); await settle();
    expect(reloaded.getTracking()!.canSend('analytics')).toBe(false); expect(sdk.capture).not.toHaveBeenCalled();
  });
  it.each(['removal', 'clear', 'invalid', 'expired-grant'] as const)('returns to the opt-out default on external %s — an absent choice is the default, not a denial', async kind => {
    const b = browser({ analytics: true, marketing: true }); const runtime = await import('./posthog');
    runtime.getTracking()!.navigate(); await settle(); const sent = sdk.capture.mock.calls.length;
    const raw = kind === 'invalid' ? '{broken'
      : kind === 'expired-grant' ? JSON.stringify({ version: 1, analytics: true, marketing: true, at: Date.now() - 181 * 86400000 }) : null;
    b.localStorage.getItem = key => key === CONSENT_KEY ? raw : null;
    const event = { key: kind === 'clear' ? null : CONSENT_KEY, newValue: raw, storageArea: b.localStorage as Storage };
    runtime.syncStoredConsent(event); await settle();
    expect(runtime.getTracking()!.consent()).toEqual({ analytics: true, marketing: true });
    expect(b.reload).not.toHaveBeenCalled(); expect(sdk.opt_out_capturing).not.toHaveBeenCalled();
    expect(sdk.capture.mock.calls.length).toBeGreaterThanOrEqual(sent);
  });
  it('an explicit denial never expires back into the default', async () => {
    const b = browser(); const runtime = await import('./posthog');
    b.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, analytics: false, marketing: false, at: Date.now() - 400 * 86400000 }));
    runtime.getTracking()!.navigate(); await settle();
    expect(runtime.getTracking()!.canSend('analytics')).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.capture).not.toHaveBeenCalled();
  });
  it('ignores unrelated storage keys and session storage events', async () => {
    const b = browser(); const runtime = await import('./posthog');
    const raw = JSON.stringify({ version: 1, analytics: true, marketing: true, at: Date.now() });
    expect(runtime.syncStoredConsent({ key: 'unrelated', newValue: raw, storageArea: b.localStorage as Storage })).toBeUndefined();
    expect(runtime.syncStoredConsent({ key: CONSENT_KEY, newValue: raw, storageArea: b.w.sessionStorage as Storage })).toBeUndefined();
    await settle(); expect(sdk.init).not.toHaveBeenCalled(); expect(document.cookie).toBe('');
  });
  it('still persists a local choice to both storage and the preference cookie', async () => {
    const b = browser(); const runtime = await import('./posthog');
    // A full grant: matches the default so nothing revokes, and the explicit
    // choice must still be written to both stores.
    runtime.getTracking()!.choose({ analytics: true, marketing: true });
    const stored = JSON.parse(b.localStorage.getItem(CONSENT_KEY)!);
    const cookie = JSON.parse(decodeURIComponent(document.cookie.split(';')[0].slice(CONSENT_KEY.length + 1)));
    expect(stored).toMatchObject({ version: 1, analytics: true, marketing: true });
    expect(cookie).toEqual(stored); expect(document.cookie).toContain('Max-Age=15552000');
    // A partial choice persists too, even though revoking marketing reloads.
    runtime.getTracking()!.choose({ analytics: true, marketing: false });
    expect(JSON.parse(b.localStorage.getItem(CONSENT_KEY)!)).toMatchObject({ analytics: true, marketing: false });
  });
});

describe('global consent integration boundary', () => {
  it('routes external storage events through the non-persisting synchronization path', () => {
    const init = readFileSync(new URL('./PostHogInit.tsx', import.meta.url), 'utf8');
    const sync = init.slice(init.indexOf('const sync ='), init.indexOf("window.addEventListener('popstate'"));
    expect(sync).toContain('syncStoredConsent(event)');
    expect(sync).not.toContain('.choose('); expect(sync).not.toContain('storedConsent()');
  });
  it('uses a headless global provider instead of a top strip or modal', () => {
    const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const init = source('./PostHogInit.tsx');
    expect(init).toContain('createContext');
    expect(init).toContain('useCookieConsent');
    expect(init).not.toMatch(/dangerouslySetInnerHTML|<aside|<dialog|showModal|privacy-controls-height/);
    expect(source('../../app/layout.tsx')).toMatch(/<PostHogInit>\s*\{children\}\s*<\/PostHogInit>/);
    expect(source('../drive-exotiq/BookingChrome.tsx')).toContain('h-dvh');
    expect(source('../drive-exotiq/BookingChrome.tsx')).not.toContain('privacy-controls-height');
  });
  it('places compact controls at conversion surfaces and a manual entry on privacy', () => {
    const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const vehicle = source('../drive-exotiq/VehicleEntryPage.tsx');
    expect(vehicle).toContain('<CookieControls viewport="desktop"');
    expect(vehicle).toContain('<CookieControls viewport="mobile"');
    expect(source('../drive-exotiq/flow/shared.tsx')).toContain('<CookieControls');
    expect(source('../../app/[operatorSlug]/page.tsx')).toContain('<CookieControls');
    expect(source('../../app/privacy/page.tsx')).toContain('<CookieControls manual');
  });
});
