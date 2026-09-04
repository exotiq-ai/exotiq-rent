/**
 * Funnel analytics (M7e / MP-6, decision 2026-08-21: PostHog).
 *
 * Loaded from PostHog's own snippet, not an npm dependency: nothing ships in
 * the bundle and nothing runs unless NEXT_PUBLIC_POSTHOG_KEY is set on the
 * deploy. Every call below is a no-op without it, so the same build serves
 * hosts with and without analytics.
 *
 * Event names are the funnel the marketplace exists to measure:
 *   browse_view → vehicle_view → book_start → book_step → booking_created
 *   → confirmation_view
 * Keep them stable; dashboards key on them.
 */
export type FunnelEvent =
  | 'browse_view'
  | 'vehicle_view'
  | 'book_start'
  | 'book_step'
  | 'booking_created'
  | 'confirmation_view'
  // MP-14 renter capture: never carries an e-mail address, only the surface and slugs.
  | 'favourite_added'
  | 'capture_start'
  | 'capture_sent'
  | 'alert_created'
  | 'saved_view';

type PostHogLike = { capture: (event: string, properties?: Record<string, unknown>) => void };

export function posthogKey(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
}

export function posthogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
}

/**
 * Redacts renter credentials from anything PostHog is about to send. Two
 * links in this product carry a secret in the query string: the confirmation
 * page (`/booking/BK-…?t=…`) and the identity link (`/verify?ref=…&token=…`).
 * Applied to EVERY string property rather than a fixed key list, because
 * posthog-js adds URL-bearing properties of its own ($current_url, $referrer,
 * $initial_*, $session_entry_url, …) and a list would drift.
 *
 * Deliberately self-contained (no closures, no helpers): its source is
 * embedded verbatim in the browser snippet via Function.prototype.toString.
 */
export function redactCredentialUrls<T extends Record<string, unknown>>(props: T): T {
  for (const key in props) {
    const value = props[key];
    if (typeof value === 'string') {
      (props as Record<string, unknown>)[key] = value.replace(/([?&](?:t|token)=)[^&#]*/gi, '$1redacted');
    }
  }
  return props;
}

/**
 * PostHog's official loader snippet plus init. Pure string so it can be
 * unit-tested without rendering; PostHogInit emits it as an inline script in
 * the server-rendered HTML — before the page — so the queueing stub exists
 * before any React effect calls track(). (A next/script afterInteractive tag
 * installs the stub from its own useEffect, which runs AFTER the children's
 * effects: every full-page-load event was dropped that way.)
 *
 * `person_profiles: 'identified_only'` keeps anonymous browsing anonymous —
 * renters are never identified by this app (no identify() call exists).
 * `before_send` runs redactCredentialUrls over properties, $set and $set_once
 * of every event; session recording stays off.
 */
export function posthogSnippet(key: string, host: string): string {
  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(${JSON.stringify(key)},{api_host:${JSON.stringify(host)},person_profiles:'identified_only',capture_pageview:true,capture_pageleave:true,disable_session_recording:true,before_send:function(e){if(!e)return e;var r=${redactCredentialUrls.toString()};if(e.properties)r(e.properties);if(e.$set)r(e.$set);if(e.$set_once)r(e.$set_once);return e}});`;
}

export function track(event: FunnelEvent, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const ph = (window as unknown as { posthog?: PostHogLike }).posthog;
  if (!ph || typeof ph.capture !== 'function') return;
  ph.capture(event, properties);
}
