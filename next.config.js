// Maintenance wall (MP-37): decided here, once per build. Off (the default), this config is exactly
// the normal one and no middleware is compiled. On, the build is an app that holds nothing but the
// wall: middleware.wall.ts and app/[[...wall]]/route.wall.ts both answer with the 503 wall page.
// See docs/rent/MAINTENANCE_WALL.md.
const wall = require('./domain/maintenance/flags.js').readWall();

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // A wall build redirects nothing: redirects run before middleware.
    if (wall.on) return [];
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
    return [
      { source: '/', destination: `/${defaultTeam}`, permanent: false },
      // The Exotiq team slug was renamed 'exotiq-' → 'exotiq' on 2026-07-22.
      // Links shared under the old slug (storefront + share cards) live on in
      // text threads — keep them landing on the renamed team.
      { source: '/exotiq-', destination: '/exotiq', permanent: false },
      { source: '/exotiq-/:path*', destination: '/exotiq/:path*', permanent: false },
      { source: '/share/exotiq-/:path*', destination: '/share/exotiq/:path*', permanent: false },
    ];
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
    // 2048 is the realistic ceiling: the widest frame is 840 CSS px inside a
    // 1200px container, so 3840 only inflated srcsets and optimizer work.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Optimized responses were shipping Cache-Control max-age=0, so browsers
    // revalidated every photo on every view. Storage paths are immutable
    // (a re-upload mints a new path) and signed URLs carry the token in the
    // cache key, so 31 days is safe for both.
    minimumCacheTTL: 2678400,
  },
  compress: true,
  poweredByHeader: false,
  // Enable SWC minification
  swcMinify: true,
  // Optimize fonts
  reactStrictMode: true,
  // Wall build only: only *.wall.ts(x) files are compiled, so the middleware and the catch-all route
  // are the whole app (two entries: Next 14.2 fails on a single one); a fixed build id lets the
  // checker probe the data-request shape; env inlines the two optional wall values (server side only).
  ...(wall.on
    ? { pageExtensions: ['wall.ts', 'wall.tsx'], generateBuildId: async () => 'maintenance-wall', env: wall.env }
    : {}),
};

module.exports = nextConfig;
