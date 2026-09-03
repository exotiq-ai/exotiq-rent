import { posthogHost, posthogKey, posthogSnippet } from './posthog';

/**
 * Emits PostHog's snippet as a plain inline script in the server-rendered
 * HTML when a key is configured; renders nothing otherwise. Rendered BEFORE
 * the page in app/layout.tsx so the browser executes it at parse time — the
 * queueing stub is then in place before hydration runs any TrackView effect.
 * (next/script afterInteractive installs its stub from a useEffect that runs
 * after the children's effects, which dropped every full-page-load event.)
 * Only the public project key is ever inlined.
 */
export function PostHogInit() {
  const key = posthogKey();
  if (!key) return null;
  // eslint-disable-next-line react/no-danger -- first-party generated script, no user input
  return <script id="posthog-init" dangerouslySetInnerHTML={{ __html: posthogSnippet(key, posthogHost()) }} />;
}
