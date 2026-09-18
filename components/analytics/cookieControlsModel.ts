import { credentialUrl, trackingConfig, type Consent, type TrackingEnvironment } from './policy';

export type CookieControlsVisibility = 'hidden' | 'row' | 'preferences';
type ControlLocation = { hostname: string; pathname: string; href: string; referrer: string };

/** Prompt only where the existing runtime can load a configured provider. */
export function cookieControlsVisibility({ environment, location, ready, hasSavedChoice, manual = false }: {
  environment: TrackingEnvironment;
  location: ControlLocation;
  ready: boolean;
  hasSavedChoice: boolean;
  manual?: boolean;
}): CookieControlsVisibility {
  if (manual) return 'preferences';
  if (!ready) return 'hidden';
  const config = trackingConfig(environment, location.hostname, location.pathname);
  if (config.eligible && (config.posthogKey || config.metaPixelId) && !credentialUrl(location.href) && !credentialUrl(location.referrer)) return 'row';
  return hasSavedChoice ? 'preferences' : 'hidden';
}

export function cookieControlState(choice: Consent, gpc: boolean): { label: 'Off' | 'On' | 'Custom'; checked: boolean | 'mixed' } {
  const analytics = choice.analytics, advertising = choice.marketing && !gpc;
  if (analytics && advertising) return { label: 'On', checked: true };
  if (analytics || advertising) return { label: 'Custom', checked: 'mixed' };
  return { label: 'Off', checked: false };
}

/** A mixed choice switches OFF, never silently broadening an independent grant. */
export function toggleOptionalCookies(choice: Consent, gpc: boolean): Consent {
  const next = cookieControlState(choice, gpc).checked === false;
  return { analytics: next, marketing: next && !gpc };
}
