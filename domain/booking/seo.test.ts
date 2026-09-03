import { afterEach, describe, expect, it, vi } from 'vitest';
import { posthogHost, posthogKey, posthogSnippet, track } from '../../components/analytics/posthog';
import { browseEnabled, siteUrl } from './config';
import { robotsPolicy as robots } from './seo';

describe('PostHog gating', () => {
  it('has no key unless the deploy sets one, and defaults to the US host', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(posthogKey()).toBe('');
    expect(posthogHost()).toBe('https://us.i.posthog.com');
  });

  it('builds the snippet with the public key, host and anonymous profiles', () => {
    const s = posthogSnippet('phc_test', 'https://eu.i.posthog.com');
    expect(s).toContain('posthog.init("phc_test"');
    expect(s).toContain('api_host:"https://eu.i.posthog.com"');
    expect(s).toContain("person_profiles:'identified_only'");
    expect(s).toContain('disable_session_recording:true');
    expect(s).not.toContain('identify(');
  });

  it('redacts the confirmation access token from every URL property PostHog records', () => {
    const s = posthogSnippet('phc_test', 'https://us.i.posthog.com');
    const body = s.slice(s.indexOf('sanitize_properties:') + 'sanitize_properties:'.length);
    const fn = new Function(`return (${body.slice(0, body.lastIndexOf('}') )})`)() as (p: Record<string, unknown>) => Record<string, unknown>;
    const out = fn({ $current_url: 'https://book.exotiq.rent/booking/BK-1?t=secret123&payment=success', $referrer: 'https://x/?a=1&t=abc#h', $pathname: '/booking/BK-1', other: 'keep' });
    expect(out.$current_url).toBe('https://book.exotiq.rent/booking/BK-1?t=redacted&payment=success');
    expect(out.$referrer).toBe('https://x/?a=1&t=redacted#h');
    expect(out.other).toBe('keep');
    expect(JSON.stringify(out)).not.toContain('secret123');
  });

  it('track() is a no-op without the snippet and forwards to capture with it', () => {
    const g = globalThis as unknown as { window?: unknown };
    delete g.window;
    expect(() => track('browse_view', { a: 1 })).not.toThrow();
    const capture = vi.fn();
    g.window = { posthog: { capture } };
    track('vehicle_view', { team: 'exotiq' });
    expect(capture).toHaveBeenCalledWith('vehicle_view', { team: 'exotiq' });
    delete g.window;
  });
});

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('siteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL, then the Netlify URL, without a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://exotiq.rent/';
    process.env.URL = 'https://book-exotiq-rent.netlify.app';
    expect(siteUrl()).toBe('https://exotiq.rent');
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe('https://book-exotiq-rent.netlify.app');
    delete process.env.URL;
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('browseEnabled', () => {
  it('needs booking mode AND the flag', () => {
    delete process.env.NEXT_PUBLIC_SITE_MODE;
    process.env.NEXT_PUBLIC_MARKETPLACE_BROWSE = 'on';
    expect(browseEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_SITE_MODE = 'marketplace';
    expect(browseEnabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_SITE_MODE;
    process.env.NEXT_PUBLIC_MARKETPLACE_BROWSE = 'off';
    expect(browseEnabled()).toBe(false);
  });
});

describe('robots per host', () => {
  it('disallows everything on mock data (demo host)', () => {
    delete process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE;
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('allows storefronts and hides renter-private surfaces on live data', () => {
    process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE = 'supabase';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.URL = 'https://book.exotiq.rent';
    const out = robots();
    expect(out.sitemap).toBe('https://book.exotiq.rent/sitemap.xml');
    expect(out.rules).toEqual({ userAgent: '*', allow: '/', disallow: ['/verify', '/booking/', '/share/', '/preview'] });
  });
});
