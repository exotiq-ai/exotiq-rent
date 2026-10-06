// MP-18 AC12: homeLink() is the 404's tenant-neutral CTA logic, lifted into config.ts so the 404
// and the error boundary share it. The 404's CTA (href and label) is identical before and after,
// in both modes, with and without the env slug; the old mock tenant slug (T-8) never comes back.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { stripComments } from '../../tests/design/lib/scan.mjs';
import { ctaClassName } from '../../components/browse/tokens';
import * as config from './config';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const homeLink = () => (config as unknown as { homeLink: () => { href: string; label: string } }).homeLink();

afterEach(() => vi.unstubAllEnvs());

const mode = (site: 'booking' | 'marketplace', slug?: string) => {
  vi.stubEnv('NEXT_PUBLIC_SITE_MODE', site);
  vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', slug);
};

describe('MP-18 homeLink (AC12)', () => {
  it('homeLink in marketplace mode', () => {
    for (const slug of [undefined, 'acme']) {
      mode('marketplace', slug);
      expect(homeLink()).toEqual({ href: '/', label: 'Back to Drive Exotiq' });
    }
  });

  it('homeLink in booking mode uses the default team slug', () => {
    mode('booking', 'acme');
    expect(homeLink()).toEqual({ href: '/acme', label: 'Continue browsing' });
    mode('booking', 'exotiq');
    expect(homeLink()).toEqual({ href: '/exotiq', label: 'Continue browsing' });
  });

  it('homeLink falls back to exotiq without the env slug', () => {
    mode('booking', undefined);
    expect(homeLink()).toEqual({ href: '/exotiq', label: 'Continue browsing' });
    // `??`, exactly as the 404 had it: an unset slug falls back, a set one is used as given.
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', undefined);
    expect(homeLink()).toEqual({ href: '/exotiq', label: 'Continue browsing' });
  });

  it('not-found renders the same call to action in both modes', async () => {
    const NotFound = (await import('../../app/not-found')).default as ComponentType;
    const cases: [Parameters<typeof mode>, string, string][] = [
      [['booking', undefined], '/exotiq', 'Continue browsing'],
      [['booking', 'acme'], '/acme', 'Continue browsing'],
      [['marketplace', undefined], '/', 'Back to Drive Exotiq'],
      [['marketplace', 'acme'], '/', 'Back to Drive Exotiq'],
    ];
    for (const [[site, slug], href, label] of cases) {
      mode(site, slug);
      const html = renderToStaticMarkup(createElement(NotFound));
      // The CTA exactly as the 404 rendered it before the lift (same classes, href and label).
      expect(html, `${site} ${slug}`).toContain(`<a class="mt-6 rounded-xl px-6 py-3.5 text-body font-semibold ${ctaClassName}" href="${href}">${label}</a>`);
      expect(html.split(`>${label}</a>`).length - 1).toBe(1);
    }
    // The 404 asks homeLink() instead of keeping its own copy of the rule.
    const notFound = stripComments(readFileSync(join(ROOT, 'app/not-found.tsx'), 'utf8'));
    expect(notFound).toContain('const home = homeLink();');
    expect(notFound).not.toContain('NEXT_PUBLIC_DEFAULT_TEAM_SLUG');
  });

  it('the old mock tenant slug never comes back (T-8)', () => {
    for (const rel of ['domain/booking/config.ts', 'app/not-found.tsx', 'app/error.tsx']) {
      if (rel === 'app/error.tsx' && !existsSync(join(ROOT, rel))) continue;
      expect(stripComments(readFileSync(join(ROOT, rel), 'utf8')), rel).not.toContain('desert-exotic-rentals');
    }
    mode('booking', undefined);
    expect(homeLink().href).not.toContain('desert-exotic-rentals');
  });
});
