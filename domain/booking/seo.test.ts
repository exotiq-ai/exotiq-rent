import { afterEach, describe, expect, it } from 'vitest';
import { posthogHost, posthogKey, track } from '../../components/analytics/posthog';
import { sanitizePostHogEvent, trackingConfig } from '../../components/analytics/policy';
import { browseEnabled, siteUrl } from './config';
import { robotsPolicy as robots } from './seo';

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('PostHog gating', () => {
  it('has no key unless the deploy sets one, and defaults to the US host', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY; delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(posthogKey()).toBe(''); expect(posthogHost()).toBe('https://us.i.posthog.com');
  });
  it('a public key alone does not enable tracking and invalid/private keys are never usable', () => {
    expect(trackingConfig({ posthogKey: 'phc_test' }, 'book.exotiq.rent', '/exotiq').eligible).toBe(false);
    for (const key of ['phs_secret', 'phx_secret', '<script>']) expect(trackingConfig({ posthogKey: key }, 'book.exotiq.rent', '/exotiq').posthogKey).toBe('');
  });
  it('rebuilds an event with no raw credentials, private paths, referrer query, or person data', () => {
    const clean = sanitizePostHogEvent({ event: '$pageview', properties: {
      token: 'phc_test', $current_url: 'https://book.exotiq.rent/exotiq?t=secret123&payment=success',
      $referrer: 'https://book.exotiq.rent/verify?ref=BK-1&token=secretTOKEN#h',
      $session_entry_url: 'https://book.exotiq.rent/booking/BK-1?T=upper',
      $pathname: '/booking/BK-1', $set_once: { email: 'renter@example.com' },
    } });
    expect(clean?.properties.$current_url).toBe('https://book.exotiq.rent/exotiq');
    expect(clean?.properties.$referrer).toBe('https://book.exotiq.rent/');
    expect(clean?.properties.token).toBe('phc_test');
    expect(JSON.stringify(clean)).not.toMatch(/secret|BK-1|renter|\$set|session_entry/);
  });
  it('track is safe during server rendering; browser lifecycle is covered by runtime tests', () => {
    expect(() => track('browse_view', { query: '?token=private' })).not.toThrow();
  });
});

describe('siteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL, then the Netlify URL, without a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://exotiq.rent/'; process.env.URL = 'https://book-exotiq-rent.netlify.app';
    expect(siteUrl()).toBe('https://exotiq.rent'); delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe('https://book-exotiq-rent.netlify.app'); delete process.env.URL;
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('browseEnabled', () => {
  it('needs booking mode AND the flag', () => {
    delete process.env.NEXT_PUBLIC_SITE_MODE; process.env.NEXT_PUBLIC_MARKETPLACE_BROWSE = 'on';
    expect(browseEnabled()).toBe(true); process.env.NEXT_PUBLIC_SITE_MODE = 'marketplace';
    expect(browseEnabled()).toBe(false); delete process.env.NEXT_PUBLIC_SITE_MODE;
    process.env.NEXT_PUBLIC_MARKETPLACE_BROWSE = 'off'; expect(browseEnabled()).toBe(false);
  });
});

describe('robots per host', () => {
  it('disallows everything on mock data (demo host)', () => {
    delete process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE;
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
  it('allows storefronts and hides renter-private surfaces on live data', () => {
    process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE = 'supabase'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'; process.env.URL = 'https://book.exotiq.rent';
    const out = robots(); expect(out.sitemap).toBe('https://book.exotiq.rent/sitemap.xml');
    expect(out.rules).toEqual({ userAgent: '*', allow: '/', disallow: ['/verify', '/booking/', '/share/', '/preview'] });
  });
});
