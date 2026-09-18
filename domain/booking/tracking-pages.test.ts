import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

// These are integration-boundary contracts. Browser QA exercises the rendered
// routes; these guard against reintroducing credential-bearing SPA handoffs.
describe('tracking page integration boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not hide the privacy notice behind the marketplace browse launch gate', () => {
    expect(source('app/privacy/page.tsx')).not.toContain('if (!browseEnabled()) notFound()');
  });

  it('discloses the advertising provider, choices, and disabled session recording', () => {
    const privacy = source('app/privacy/page.tsx');
    expect(privacy).toContain('Meta');
    expect(privacy).toContain('Privacy preferences');
    expect(privacy).toContain('Session recording is disabled');
    expect(privacy).not.toContain('This host runs no analytics or advertising trackers.');
  });

  it('does not let the legal page link to unavailable browse and terms pages', () => {
    const chrome = source('components/browse/BrowseChrome.tsx');
    expect(chrome).toContain('homeHref={browseEnabled() ?');
    expect(chrome).toContain('{browseEnabled() && <Link href="/terms"');
  });

  it('adds storefront funnel coverage to populated and empty storefronts', () => {
    const storefront = source('app/[operatorSlug]/page.tsx');
    expect(storefront.match(/<TrackView event="storefront_view"/g)).toHaveLength(2);
  });

  it('uses a full document navigation for the credential-bearing confirmation link', () => {
    const flow = source('components/drive-exotiq/BookingFlow.tsx');
    expect(flow).toContain('window.location.assign(`/booking/');
    expect(flow).not.toContain('router.push(`/booking/');
  });

  it('does not send the renter protection choice in request analytics', () => {
    const flow = source('components/drive-exotiq/BookingFlow.tsx');
    const event = flow.split("track('booking_created',")[1]?.split('\n')[0];
    expect(event).toBeDefined();
    expect(event).not.toContain('protection');
    expect(event).not.toContain('confirmationToken');
  });
});
