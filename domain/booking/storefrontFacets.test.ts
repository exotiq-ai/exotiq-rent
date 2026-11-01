// MP-36 AC1/AC8: the storefront facet gate reads NEXT_PUBLIC_STOREFRONT_FACETS literally; only the exact string
// 'on' enables it (so a Netlify site with the variable absent ships hidden), and site mode plays no part (A5).
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as config from './config';

const enabled = () => (config as unknown as { storefrontFacetsEnabled: () => boolean }).storefrontFacetsEnabled();

afterEach(() => vi.unstubAllEnvs());

describe('MP-36 storefrontFacetsEnabled', () => {
  it('storefrontFacetsEnabled is on only when NEXT_PUBLIC_STOREFRONT_FACETS is exactly on', () => {
    for (const value of [undefined, '', 'ON', 'On', 'true', '1', 'off', ' on', 'on ']) {
      vi.stubEnv('NEXT_PUBLIC_STOREFRONT_FACETS', value);
      expect(enabled(), JSON.stringify(value)).toBe(false);
    }
    vi.stubEnv('NEXT_PUBLIC_STOREFRONT_FACETS', 'on');
    expect(enabled()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'marketplace');
    expect(enabled(), 'not gated on site mode').toBe(true);
  });
});
