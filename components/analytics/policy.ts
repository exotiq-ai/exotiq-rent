/** Privacy policy shared by the browser controller and the SDK's final send hook. */
export type TrackingEnvironment = { enabled?: string; dataMode?: string; posthogKey?: string; posthogHost?: string; metaPixelId?: string };
export type Consent = { analytics: boolean; marketing: boolean };
export type AnalyticsEvent = { event: string; properties: Record<string, unknown>; uuid?: unknown; timestamp?: unknown; $set?: unknown; $set_once?: unknown };
export const PRODUCTION_HOST = 'book.exotiq.rent';
export const DENIED: Consent = { analytics: false, marketing: false };
export const EVENTS = ['browse_view', 'storefront_view', 'vehicle_view', 'book_start', 'book_step', 'booking_created', 'confirmation_view', 'favourite_added', 'capture_start', 'capture_sent', 'alert_created', 'saved_view', 'booking_request_failed', 'checkout_started'] as const;
export type FunnelEvent = typeof EVENTS[number];
// fbclid joins the whitelist so a PostHog session can be tied back to the Meta
// click that bought it; the pixel reads the live URL itself and never needed it.
export const ATTRIBUTION_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'adset_id', 'ad_id', 'placement', 'fbclid'] as const;
export function attributionValue(value: unknown, field?: string): string | undefined {
  if (typeof value !== 'string' || /token|secret|password|bearer|ph[scx]_|sk_|eyJ|[a-f0-9]{32}/i.test(value)) return undefined;
  // fbclid is by design a long opaque click id — the generic "40 consecutive
  // alphanumerics is a leaked credential" guard would reject every real value.
  if (field === 'fbclid') return /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : undefined;
  return /^[a-zA-Z0-9 _.-]{1,80}$/.test(value) && !/[a-zA-Z0-9]{40}/.test(value) ? value : undefined;
}
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const opaque = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Every non-tenant top-level route. A new reserved route MUST be added here or
// its visitors get the cookie row and a tenant-shaped $pageview.
const RESERVED_ROUTES = new Set(['api', 'booking', 'browse', 'preview', 'privacy', 'renters', 'saved', 'share', 'terms', 'verify']);

/** Any tenant storefront, vehicle page, or booking start — not just the exotiq
 * launch tenant. Paid traffic lands on other slugs now (e.g. /ark). */
export function eligibleRoute(path: string): boolean {
  if (path.length >= 180) return false;
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/book)?)?\/?$/.exec(path);
  return !!match && !RESERVED_ROUTES.has(match[1]);
}
/** Meta reads the live URL itself. Do not load either SDK on a credential-bearing document. */
export function credentialUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return !!(url.username || url.password || url.hash) || Array.from(url.searchParams.keys()).some(key => /^(t|token|r)$/i.test(key));
  } catch { return true; }
}
export function trackingConfig(env: TrackingEnvironment, host: string, path: string) {
  const posthogHost = env.posthogHost || 'https://us.i.posthog.com';
  const validHost = ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(posthogHost);
  return {
    eligible: env.enabled === 'true' && env.dataMode === 'supabase' && host === PRODUCTION_HOST && eligibleRoute(path),
    posthogKey: validHost && /^phc_[a-zA-Z0-9]+$/.test(env.posthogKey || '') ? env.posthogKey! : '',
    posthogHost: validHost ? posthogHost : 'https://us.i.posthog.com',
    metaPixelId: /^\d{10,20}$/.test(env.metaPixelId || '') ? env.metaPixelId! : '',
  };
}
export function consentValue(value: unknown, gpc: boolean): Consent {
  if (!value || typeof value !== 'object') return { ...DENIED };
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.analytics !== 'boolean' || typeof v.marketing !== 'boolean') return { ...DENIED };
  return { analytics: v.analytics, marketing: v.marketing && !gpc };
}
/** No freeform text, dates, contact/identity data, booking refs, query strings or nested values. */
export function sanitizeProperties(event: string, props: Record<string, unknown>): Record<string, unknown> | null {
  if (event !== '$pageview' && !(EVENTS as readonly string[]).includes(event)) return null;
  const out: Record<string, unknown> = {};
  if (typeof props.team === 'string' && props.team.length <= 60 && slug.test(props.team) && !RESERVED_ROUTES.has(props.team)) out.team = props.team;
  if (typeof props.vehicle === 'string' && props.vehicle.length <= 120 && slug.test(props.vehicle)) out.vehicle = props.vehicle;
  if (typeof props.path === 'string' && eligibleRoute(props.path)) out.path = props.path;
  if (event === 'book_step' && Number.isInteger(props.step) && Number(props.step) >= 1 && Number(props.step) <= 10) out.step = props.step;
  if (event === 'booking_request_failed' && ['network', 'validation', 'unavailable', 'server', 'unknown'].includes(String(props.reason))) out.reason = props.reason;
  if (event === 'booking_created' && typeof props.event_id === 'string' && /^booking_created_[a-f0-9-]{36}$/i.test(props.event_id)) out.event_id = props.event_id;
  return out;
}
export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.origin + (url.hostname === PRODUCTION_HOST && eligibleRoute(url.pathname) ? url.pathname : '/');
  } catch { return undefined; }
}
/** Rebuild rather than redact: new SDK default properties cannot silently expand collection. */
export function sanitizePostHogEvent(event: AnalyticsEvent | null): AnalyticsEvent | null {
  if (!event) return null;
  const properties = sanitizeProperties(event.event, event.properties || {});
  if (!properties) return null;
  // The SDK validates this PUBLIC ingestion key after before_send; never retain server keys.
  const token = event.properties.token;
  if (typeof token === 'string' && /^phc_[a-zA-Z0-9]+$/.test(token)) properties.token = token;
  if (['Desktop', 'Mobile', 'Tablet'].includes(String(event.properties.$device_type))) properties.$device_type = event.properties.$device_type;
  for (const key of ['$current_url', '$referrer']) {
    const url = sanitizeUrl(event.properties[key]);
    if (url) properties[key] = url;
  }
  for (const key of ['distinct_id', '$device_id', '$session_id', '$window_id', '$insert_id']) {
    const value = event.properties[key];
    if (typeof value === 'string' && opaque.test(value)) properties[key] = value;
  }
  for (const prefix of ['first', 'last']) for (const field of ATTRIBUTION_FIELDS) {
    const key = `${prefix}_${field}`;
    const value = attributionValue(event.properties[key], field);
    if (value) properties[key] = value;
  }
  properties.$process_person_profile = false;
  // Top-level SDK payload fields are rebuilt too: do not retain $set/$set_once.
  const clean: AnalyticsEvent = { event: event.event, properties };
  if (typeof event.uuid === 'string' && opaque.test(event.uuid)) clean.uuid = event.uuid;
  if (event.timestamp instanceof Date && Number.isFinite(event.timestamp.getTime())) clean.timestamp = event.timestamp;
  return clean;
}
