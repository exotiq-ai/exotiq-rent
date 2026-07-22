/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Demo (D7): land visitors straight on the demo storefront instead of
    // the legacy marketplace homepage. Temporary (307) so it can be
    // repointed or removed without browsers caching it.
    return [{ source: '/', destination: '/desert-exotic-rentals', permanent: false }];
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
