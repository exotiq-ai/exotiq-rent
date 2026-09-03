import { afterEach, describe, expect, it, vi } from 'vitest';
import { posthogHost, posthogKey, posthogSnippet, redactCredentialUrls, track } from '../../components/analytics/posthog';
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

  it('redacts both renter credentials from every string property, whatever its key', () => {
    const out = redactCredentialUrls({
      $current_url: 'https://book.exotiq.rent/booking/BK-1?t=secret123&payment=success',
      $referrer: 'https://book.exotiq.rent/verify?ref=BK-1&token=secretTOKEN#h',
      $session_entry_url: 'https://book.exotiq.rent/booking/BK-1?T=upper',
      $pathname: '/booking/BK-1',
      other: 'keep',
      n: 3,
    });
    expect(out.$current_url).toBe('https://book.exotiq.rent/booking/BK-1?t=redacted&payment=success');
    expect(out.$referrer).toBe('https://book.exotiq.rent/verify?ref=BK-1&token=redacted#h');
    expect(out.$session_entry_url).toBe('https://book.exotiq.rent/booking/BK-1?T=redacted');
    expect(out.other).toBe('keep');
    expect(out.n).toBe(3);
    expect(JSON.stringify(out)).not.toMatch(/secret/);
  });

  it('embeds the redactor in the snippet through before_send (not the deprecated hook) and it runs standalone', () => {
    const s = posthogSnippet('phc_test', 'https://us.i.posthog.com');
    expect(s).not.toContain('sanitize_properties');
    const start = s.indexOf('before_send:') + 'before_send:'.length;
    // The hook is the last config entry: keep its closing brace, drop the init call's `});`.
    const body = s.slice(start, s.lastIndexOf('}});') + 1);
    const hook = new Function(`return (${body})`)() as (e: { properties?: Record<string, unknown>; $set_once?: Record<string, unknown> } | null) => unknown;
    expect(hook(null)).toBeNull();
    const event = { properties: { $session_entry_url: 'https://x/booking/BK-1?t=SECRET' }, $set_once: { $initial_referrer: 'https://x/verify?ref=BK-1&token=SECRET2' } };
    const out = hook(event) as typeof event;
    expect(JSON.stringify(out)).not.toContain('SECRET');
    expect(out.properties.$session_entry_url).toBe('https://x/booking/BK-1?t=redacted');
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
