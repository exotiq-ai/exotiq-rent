/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Site split (2026-07-22): booking mode (default, book.exotiq.rent)
    // lands visitors straight on a storefront. Marketplace mode
    // (exotiq.rent, NEXT_PUBLIC_SITE_MODE=marketplace) serves the public
    // marketplace mockup at the root instead. Temporary (307) so it can be
    // repointed without browsers caching it.
    if (process.env.NEXT_PUBLIC_SITE_MODE === 'marketplace') return [];
    // Which storefront the root lands on is per-deploy: the live site sets
    // NEXT_PUBLIC_DEFAULT_TEAM_SLUG to the Exotiq tenant; the mock demo
    // (no env) keeps landing on desert-exotic-rentals.
    const defaultTeam = process.env.NEXT_PUBLIC_DEFAULT_TEAM_SLUG || 'desert-exotic-rentals';
    const redirects = [{ source: '/', destination: `/${defaultTeam}`, permanent: false }];
    if (defaultTeam === 'exotiq-') {
      // TEMPORARY until the backend renames the Exotiq team slug 'exotiq-' →
      // 'exotiq' (slug-generation bug; see docs/rent/LOVABLE_HANDOFF_2026-07-22.md).
      // Gives renters the clean /exotiq URL today; delete once the rename lands.
      redirects.push({ source: '/exotiq', destination: '/exotiq-', permanent: false });
    }
    return redirects;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        // Supabase-mode vehicle photos: RPC-provided URLs and 1h signed
        // media URLs both come from the project's storage host.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  compress: true,
  poweredByHeader: false,
  // Enable SWC minification
  swcMinify: true,
  // Optimize fonts
  reactStrictMode: true,
};

module.exports = nextConfig;
