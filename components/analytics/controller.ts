import { DENIED, consentValue, credentialUrl, sanitizeProperties, trackingConfig, type Consent, type TrackingEnvironment } from './policy';
export type BrowserLocation = { hostname: string; pathname: string; href: string; referrer: string };
export type AnalyticsClient = { capture(event: string, properties: Record<string, unknown>, eventId?: string): void; stop(): void };
export type TrackerDependencies = {
  location(): BrowserLocation; readConsent(): Consent; saveConsent(value: Consent): void; gpc(): boolean;
  loadPostHog(allowed: () => boolean): Promise<AnalyticsClient | null>;
  loadMeta(allowed: () => boolean): Promise<AnalyticsClient | null>;
  clearIdentifiers(): void; reload(): void; attribution(): Record<string, string>;
};
type Delivery = { event: string; properties: Record<string, unknown>; id?: string };
type Channel = keyof Consent;

/** Per-document controller; pre-consent interactions are discarded, never buffered. */
export function createTracker(env: TrackingEnvironment, deps: TrackerDependencies) {
  let choice = { ...DENIED };
  try { choice = consentValue({ version: 1, ...deps.readConsent() }, deps.gpc()); } catch { /* unavailable storage = denied */ }
  let path = '';
  let visit = 0;
  let halted = false;
  const started: Partial<Record<Channel, boolean>> = {};
  const clients: Partial<Record<Channel, AnalyticsClient>> = {};
  const queues: Record<Channel, Delivery[]> = { analytics: [], marketing: [] };
  const seen = new Set<string>();
  const safe = (fn: () => void) => { try { fn(); } catch { /* analytics must not affect booking */ } };
  function canSend(channel: Channel) {
    const loc = deps.location();
    const config = trackingConfig(env, loc.hostname, loc.pathname);
    return !halted && config.eligible && !credentialUrl(loc.href) && !credentialUrl(loc.referrer) && choice[channel] && !(channel === 'marketing' && deps.gpc()) && !!(channel === 'analytics' ? config.posthogKey : config.metaPixelId);
  }
  function stop() {
    halted = true;
    queues.analytics = []; queues.marketing = [];
    for (const client of Object.values(clients)) safe(() => client?.stop());
  }
  function send(channel: Channel, delivery: Delivery, dedupe?: string) {
    if (!canSend(channel)) return;
    const key = `${channel}:${dedupe}`;
    if (dedupe && seen.has(key)) return;
    if (dedupe) seen.add(key);
    const client = clients[channel];
    if (client) { safe(() => client.capture(delivery.event, delivery.properties, delivery.id)); return; }
    // Bound memory while a content blocker stalls a SDK download.
    if (queues[channel].length < 100) queues[channel].push(delivery);
    if (started[channel]) return;
    started[channel] = true;
    const loader = channel === 'analytics' ? deps.loadPostHog : deps.loadMeta;
    try {
      void loader(() => canSend(channel)).then(loaded => {
        if (!loaded) { queues[channel] = []; return; }
        if (!canSend(channel)) { safe(() => loaded.stop()); queues[channel] = []; return; }
        clients[channel] = loaded;
        const pending = queues[channel]; queues[channel] = [];
        for (const item of pending) if (canSend(channel)) safe(() => loaded.capture(item.event, item.properties, item.id));
      }).catch(() => { queues[channel] = []; });
    } catch { queues[channel] = []; }
  }
  function dispatch(event: string, props: Record<string, unknown>, dedupe?: string) {
    const clean = sanitizeProperties(event, props);
    if (!clean) return;
    if (event === 'booking_created' && !clean.event_id) return;
    const id = typeof clean.event_id === 'string' ? clean.event_id : undefined;
    const attribution = canSend('analytics') ? deps.attribution() : {};
    send('analytics', { event, properties: { ...clean, ...attribution, $current_url: `https://book.exotiq.rent${path}` }, id }, id || dedupe);
    const metaEvent = event === '$pageview' ? 'PageView' : event === 'vehicle_view' ? 'ViewContent' : event === 'booking_created' ? 'Lead' : null;
    if (metaEvent) {
      const properties = clean.vehicle ? { content_ids: [`exotiq/${clean.vehicle}`], content_type: 'product' } : {};
      send('marketing', { event: metaEvent, properties, id }, id || dedupe);
    }
  }
  function navigate() {
    const loc = deps.location();
    if (!trackingConfig(env, loc.hostname, loc.pathname).eligible || credentialUrl(loc.href) || credentialUrl(loc.referrer)) {
      if (!halted && Object.keys(started).length) { stop(); safe(deps.reload); }
      return;
    }
    if (halted) return;
    if (path !== loc.pathname.replace(/\/$/, '')) { path = loc.pathname.replace(/\/$/, ''); visit++; }
    if (canSend('analytics') || canSend('marketing')) safe(() => { deps.attribution(); });
    dispatch('$pageview', { team: 'exotiq', path }, `${visit}:page`);
    const parts = path.split('/').filter(Boolean);
    const semantic = parts.length === 1 ? 'storefront_view' : parts.length === 2 ? 'vehicle_view' : 'book_start';
    dispatch(semantic, { team: 'exotiq', path, ...(parts[1] ? { vehicle: parts[1] } : {}) }, `${visit}:${semantic}`);
  }
  function track(event: string, props: Record<string, unknown> = {}) {
    navigate();
    if (['storefront_view', 'vehicle_view', 'book_start'].includes(event)) return; // canonical route semantics own deduplication
    dispatch(event, { ...props, path }, undefined);
  }
  function applyConsent(value: Consent, persist: boolean) {
    const next = consentValue({ version: 1, ...value }, deps.gpc());
    const revoked = (choice.analytics && !next.analytics) || (choice.marketing && !next.marketing);
    choice = next;
    if (persist) safe(() => deps.saveConsent(next));
    if (revoked) {
      stop(); safe(deps.clearIdentifiers);
      safe(deps.reload);
      return;
    }
    navigate(); // grant reports only current page; never previous interactions
  }
  const choose = (value: Consent) => applyConsent(value, true);
  // A storage event is another tab's decision, not a new local preference save.
  const syncConsent = (value: Consent) => applyConsent(value, false);
  return { navigate, track, choose, syncConsent, canSend, consent: () => ({ ...choice }), started: () => Object.keys(started).length > 0 };
}
