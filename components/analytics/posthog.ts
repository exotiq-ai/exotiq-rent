'use client';

import type { CaptureResult, PostHogConfig } from 'posthog-js';
import { createTracker, type AnalyticsClient } from './controller';
import { DEFAULT_CONSENT, sanitizePostHogEvent, trackingConfig, type Consent, type FunnelEvent, type TrackingEnvironment } from './policy';
import { CONSENT_KEY, captureAttribution, clearTrackingStorage, readChoice, saveChoice, type StorageLike } from './storage';
export type { FunnelEvent } from './policy';

export const posthogKey = () => process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
export const posthogHost = () => process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const environment = (): TrackingEnvironment => ({
  enabled: process.env.NEXT_PUBLIC_TRACKING_ENABLED,
  dataMode: process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE,
  posthogKey: posthogKey(), posthogHost: posthogHost(),
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
});
export function globalPrivacyControl(): boolean {
  return typeof window !== 'undefined' && (window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
function storage(kind: 'localStorage' | 'sessionStorage'): StorageLike | undefined {
  try { return window[kind]; } catch { return undefined; }
}
export function storedConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  // A necessary preference cookie also survives blocked localStorage writes on revocation.
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith(`${CONSENT_KEY}=`))?.slice(CONSENT_KEY.length + 1);
    if (raw) {
      const value = readChoice({ getItem: () => decodeURIComponent(raw) }, globalPrivacyControl());
      if (value) return value;
    }
  } catch { /* unavailable cookies */ }
  return readChoice(storage('localStorage'), globalPrivacyControl());
}
function writeConsentCookie(value: Consent | null, at: number, now: number) {
  const maxAge = value ? Math.max(0, Math.floor(15552000 - (now - at) / 1000)) : 0;
  const raw = value ? encodeURIComponent(JSON.stringify({ version: 1, ...value, at })) : '';
  try { document.cookie = `${CONSENT_KEY}=${raw}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`; } catch { /* in-memory choice still applies */ }
}
function persistConsent(value: Consent) {
  const now = Date.now();
  saveChoice(storage('localStorage'), value, now);
  writeConsentCookie(value, now, now);
}
/** No localStorage writeback: preserve the originating decision and its expiry. */
export function syncStoredConsent(event: Pick<StorageEvent, 'key' | 'newValue' | 'storageArea'>): Consent | null | undefined {
  if (typeof window === 'undefined' || (event.key !== CONSENT_KEY && event.key !== null) || event.storageArea !== storage('localStorage')) return undefined;
  const raw = event.key === null ? null : event.newValue;
  const now = Date.now();
  const next = readChoice({ getItem: () => raw }, globalPrivacyControl(), now);
  // Update only the cookie fallback, never renew its lifetime. Removal/clear/invalid
  // values must erase a stale grant before syncConsent can trigger a reload.
  writeConsentCookie(next, next ? JSON.parse(raw!).at : 0, now);
  // Absence of a stored choice means the opt-out default, in every tab.
  getTracking()?.syncConsent(next || { ...DEFAULT_CONSENT });
  return next;
}
function clearIdentifiers(key: string) {
  clearTrackingStorage(storage('localStorage'), key);
  clearTrackingStorage(storage('sessionStorage'), key);
  const names = ['_fbp', '_fbc', ...(key ? [`ph_${key}_posthog`, `ph_${key}_posthog_session`, `__ph_opt_in_out_${key}`] : [])];
  for (const name of names) for (const domain of ['', 'book.exotiq.rent', '.book.exotiq.rent', 'exotiq.rent', '.exotiq.rent']) {
    try { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? `; Domain=${domain}` : ''}`; } catch { /* unavailable cookies do not prevent reload */ }
  }
}

/** All settings are local to this site; never change the shared PostHog project defaults. */
async function loadPostHog(env: TrackingEnvironment, allowed: () => boolean): Promise<AnalyticsClient | null> {
  if (!allowed()) return null;
  try {
    const { default: posthog } = await import('posthog-js');
    if (!allowed()) return null;
    const config = trackingConfig(env, window.location.hostname, window.location.pathname);
    const options: Partial<PostHogConfig> = {
      api_host: config.posthogHost,
      autocapture: false, capture_pageview: false, capture_pageleave: false,
      person_profiles: 'never', disable_session_recording: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '*' },
      enable_recording_console_log: false,
      advanced_disable_flags: true, advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true, advanced_disable_toolbar_metrics: true,
      remote_config_refresh_interval_ms: 0,
      disable_external_dependency_loading: true,
      disable_surveys: true, disable_surveys_automatic_display: true,
      disable_product_tours: true, disable_conversations: true, disable_web_experiments: true,
      capture_performance: false, capture_exceptions: false, capture_heatmaps: false,
      capture_dead_clicks: false, rageclick: false,
      logs: { captureConsoleLogs: false }, metrics: { network: false },
      save_campaign_params: false, save_referrer: false,
      mask_all_element_attributes: true, mask_all_text: true,
      persistence: 'localStorage', cross_subdomain_cookie: false, secure_cookie: true,
      ip: false, request_batching: false,
      before_send: event => allowed() ? sanitizePostHogEvent(event) as CaptureResult | null : null,
    };
    posthog.init(config.posthogKey, options);
    // Route teardown persists SDK opt-out without withdrawing the application's
    // grant. Reconcile only with the live grant, including after a late init.
    if (allowed()) posthog.opt_in_capturing({ captureEventName: false });
    return {
      capture(event, properties) {
        if (!allowed()) return;
        // No hashing/promise/batch delay between booking success and document navigation.
        posthog.capture(event, properties, event === 'booking_created' ? { send_instantly: true, transport: 'sendBeacon' } : { send_instantly: true });
      },
      stop() { posthog.opt_out_capturing(); posthog.stopSessionRecording(); },
    };
  } catch { return null; } // Content blockers and offline loads must never break a booking.
}

type MetaQueue = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push?: MetaQueue; loaded: boolean; version: string; disablePushState?: boolean };
type MetaWindow = Window & { fbq?: MetaQueue; _fbq?: MetaQueue };
function loadMeta(env: TrackingEnvironment, allowed: () => boolean): Promise<AnalyticsClient | null> {
  if (!allowed()) return Promise.resolve(null);
  return new Promise(resolve => {
    const w = window as MetaWindow;
    // Do not take ownership of a pixel installed by an unrelated integration.
    if (w.fbq) { resolve(null); return; }
    let stopped = false;
    const fbq: MetaQueue = Object.assign(function (...args: unknown[]) {
      if (stopped || (!allowed() && args[0] !== 'consent')) return;
      if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: '2.0' });
    fbq.push = fbq;
    // Our route controller owns SPA PageView. The real SDK otherwise adds
    // another automatic event whenever Next.js calls history.pushState.
    fbq.disablePushState = true;
    w.fbq = fbq; w._fbq = fbq;
    const id = env.metaPixelId!;
    fbq('consent', 'grant');
    fbq('set', 'autoConfig', false, id);

    // No user-data argument: never supply email, phone or any advanced matching data.
    fbq('init', id);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.referrerPolicy = 'no-referrer';
    let settled = false;
    const stop = () => {
      try { fbq('consent', 'revoke'); } finally { stopped = true; fbq.queue.length = 0; script.remove(); }
    };
    const finish = (ok: boolean) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (!ok || !allowed()) { stop(); resolve(null); return; }
      resolve({
        capture(event, properties, eventId) {
          if (!allowed() || stopped) return;
          if (eventId) fbq('trackSingle', id, event, properties, { eventID: eventId });
          else fbq('trackSingle', id, event, properties);
        }, stop,
      });
    };
    const timer = setTimeout(() => finish(false), 10000);
    script.onload = () => finish(true); script.onerror = () => finish(false);
    try { document.head.appendChild(script); } catch { finish(false); }
  });
}

let singleton: ReturnType<typeof createTracker> | undefined;
/** Also called by child effects: never depend on parent-effect ordering. */
export function getTracking() {
  if (typeof window === 'undefined') return undefined;
  if (singleton) return singleton;
  const env = environment();
  singleton = createTracker(env, {
    location: () => ({ hostname: window.location.hostname, pathname: window.location.pathname, href: window.location.href, referrer: document.referrer }),
    // No saved choice = the opt-out default, not denial (see DEFAULT_CONSENT).
    readConsent: () => storedConsent() || { ...DEFAULT_CONSENT }, saveConsent: persistConsent,
    gpc: globalPrivacyControl,
    loadPostHog: allowed => loadPostHog(env, allowed), loadMeta: allowed => loadMeta(env, allowed),
    clearIdentifiers: () => clearIdentifiers(env.posthogKey || ''),
    reload: () => window.location.reload(),
    attribution: () => captureAttribution(storage('localStorage'), window.location.search),
  });
  return singleton;
}
const bookingIds = new Map<string, string>();
export function track(event: FunnelEvent, properties: Record<string, unknown> = {}): void {
  try {
    const tracker = getTracking();
    if (!tracker) return;
    if (event === 'booking_created') {
      if (!tracker.canSend('analytics') && !tracker.canSend('marketing')) return;
      const { booking, ...safe } = properties;
      if (typeof booking === 'string' && booking) {
        let id = bookingIds.get(booking);
        if (!id) { id = `booking_created_${window.crypto.randomUUID()}`; bookingIds.set(booking, id); }
        tracker.track(event, { ...safe, event_id: id });
      } else tracker.track(event, safe);
    } else tracker.track(event, properties);
  } catch { /* Analytics is never a dependency of booking or navigation. */ }
}
