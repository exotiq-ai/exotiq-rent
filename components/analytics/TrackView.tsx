'use client';

import { useEffect } from 'react';
import { track, type FunnelEvent } from './posthog';

/**
 * Fires one funnel event when a server-rendered page mounts. Renders nothing.
 *
 * The query string is sent only when a caller asks for it (browse views, so
 * filtered views can be split by what was filtered). Never by default: the
 * confirmation page's query carries the booking's access token, and an
 * analytics event is the wrong place for a credential.
 */
export function TrackView({ event, properties, withQuery = false }: { event: FunnelEvent; properties?: Record<string, string | number | boolean>; withQuery?: boolean }) {
  useEffect(() => {
    track(event, { ...properties, path: window.location.pathname, ...(withQuery ? { query: window.location.search } : {}) });
    // Once per mount, on purpose: a re-render is not a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
