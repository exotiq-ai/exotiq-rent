import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostHogInit } from '../../components/analytics/PostHogInit';
import { track } from '../../components/analytics/posthog';
import { browseEnabled, siteUrl } from './config';
import { robotsPolicy as robots } from './seo';

describe('PostHog gating', () => {
  it('renders nothing without a key', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(PostHogInit()).toBeNull();
  });

  it('mounts the snippet with the public key and host when configured', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
    const el = PostHogInit() as unknown as { props: { id: string; children: string } };
    expect(el.props.id).toBe('posthog-init');
    expect(el.props.children).toContain('posthog.init("phc_test"');
    expect(el.props.children).toContain('"https://eu.i.posthog.com"');
    expect(el.props.children).toContain("person_profiles:'identified_only'");
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
