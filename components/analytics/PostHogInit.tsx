import Script from 'next/script';
import { posthogHost, posthogKey, posthogSnippet } from './posthog';

/**
 * Mounts PostHog's official snippet when a key is configured; renders nothing
 * otherwise. Server component — the key is read at render on the server and
 * only its public (project) value is ever inlined.
 */
export function PostHogInit() {
  const key = posthogKey();
  if (!key) return null;
  return <Script id="posthog-init" strategy="afterInteractive">{posthogSnippet(key, posthogHost())}</Script>;
}
