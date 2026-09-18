'use client';

import { useEffect } from 'react';
import { track, type FunnelEvent } from './posthog';

/** Route semantics are deduplicated by the runtime. Raw query strings are never collected. */
export function TrackView({ event, properties }: { event: FunnelEvent; properties?: Record<string, string | number | boolean>; withQuery?: boolean }) {
  useEffect(() => {
    track(event, properties);
    // Once per mount; a rerender is not a new view. Route changes have a separate observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
