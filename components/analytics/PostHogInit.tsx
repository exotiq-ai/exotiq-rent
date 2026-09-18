'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getTracking, globalPrivacyControl, posthogHost, posthogKey, storedConsent, syncStoredConsent } from './posthog';
import { DENIED, type Consent, type TrackingEnvironment } from './policy';
import { cookieControlsVisibility, type CookieControlsVisibility } from './cookieControlsModel';

type ConsentSnapshot = { ready: boolean; choice: Consent; gpc: boolean; visibility: CookieControlsVisibility };
type CookieConsentContext = ConsentSnapshot & {
  choose: (next: Consent) => void;
  activeDetails: string | null;
  setActiveDetails: React.Dispatch<React.SetStateAction<string | null>>;
};
const CookieConsent = createContext<CookieConsentContext | null>(null);
export function useCookieConsent() {
  const context = useContext(CookieConsent);
  if (!context) throw new Error('CookieControls must be inside PostHogInit');
  return context;
}
const environment = (): TrackingEnvironment => ({
  enabled: process.env.NEXT_PUBLIC_TRACKING_ENABLED,
  dataMode: process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE,
  posthogKey: posthogKey(), posthogHost: posthogHost(),
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
});

/** One headless owner for consent, navigation guards and cross-tab synchronization. */
export function PostHogInit({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const savedChoice = useRef(false);
  const currentHref = useRef('');
  const [snapshot, setSnapshot] = useState<ConsentSnapshot>({ ready: false, choice: { ...DENIED }, gpc: false, visibility: 'hidden' });
  const [activeDetails, setActiveDetails] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const location = { hostname: window.location.hostname, pathname: window.location.pathname, href: window.location.href, referrer: document.referrer };
    setSnapshot({
      ready: true,
      choice: getTracking()?.consent() || { ...DENIED },
      gpc: globalPrivacyControl(),
      visibility: cookieControlsVisibility({ environment: environment(), location, ready: true, hasSavedChoice: savedChoice.current }),
    });
  }, []);
  const navigate = useCallback(() => {
    getTracking()?.navigate();
    if (currentHref.current !== window.location.href) {
      currentHref.current = window.location.href;
      setActiveDetails(null);
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    savedChoice.current = storedConsent() !== null;
    const sync = (event: StorageEvent) => {
      const next = syncStoredConsent(event);
      if (next === undefined) return;
      savedChoice.current = next !== null;
      refresh();
    };
    window.addEventListener('popstate', navigate);
    window.addEventListener('hashchange', navigate);
    window.addEventListener('storage', sync);
    // Guard query-only and unanticipated SPA transitions too, before another SDK event can run.
    const push = window.history.pushState, replace = window.history.replaceState;
    const pushGuard: History['pushState'] = function (...args) { push.apply(window.history, args); navigate(); };
    const replaceGuard: History['replaceState'] = function (...args) { replace.apply(window.history, args); navigate(); };
    window.history.pushState = pushGuard; window.history.replaceState = replaceGuard;
    navigate();
    return () => {
      window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); window.removeEventListener('storage', sync);
      if (window.history.pushState === pushGuard) window.history.pushState = push;
      if (window.history.replaceState === replaceGuard) window.history.replaceState = replace;
    };
  }, [navigate, refresh]);

  useEffect(() => { navigate(); }, [pathname, navigate]);

  const choose = useCallback((next: Consent) => {
    const effective = { ...next, marketing: next.marketing && !globalPrivacyControl() };
    // Preserve runtime persistence, GPC, withdrawal cleanup/reload and grant behavior.
    getTracking()?.choose(effective);
    savedChoice.current = true;
    refresh();
  }, [refresh]);

  return <CookieConsent.Provider value={{ ...snapshot, choose, activeDetails, setActiveDetails }}>{children}</CookieConsent.Provider>;
}
