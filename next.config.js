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
