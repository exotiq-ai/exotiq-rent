'use client';

import { useEffect } from 'react';
import { track, type FunnelEvent } from './posthog';

/**
 * Fires one funnel event when a server-rendered page mounts. Renders nothing.
 * The query string travels with the event so filtered browse views can be
 * split by what was filtered, without the server having to thread it through.
 */
export function TrackView({ event, properties }: { event: FunnelEvent; properties?: Record<string, string | number | boolean> }) {
  useEffect(() => {
    track(event, { ...properties, path: window.location.pathname, query: window.location.search });
    // Once per mount, on purpose: a re-render is not a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
