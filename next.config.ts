import type { NextConfig } from 'next';

const production = process.env.NODE_ENV === 'production';

/**
 * What the pages may load. Everything is ours: fonts, scripts, models and data are served from this
 * origin and the browser never calls a third party (the AI providers are reached by our own /api).
 * Next's own bootstrap and the framework's style attributes need inline script and style, and the
 * scene uploads textures from blob: and data: URLs. Development also needs eval for hot reload,
 * so the policy is only sent by production builds.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Nothing in the product needs these; clipboard and sharing stay allowed for the buttons that use them.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  ...(production ? [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A production build can run next to the dev server (tests, checks) by pointing
  // it at its own output folder: NEXT_DIST_DIR=.next-check next build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // Off for users. `NEXT_SOURCE_MAPS=1` on a check build lets us see which module landed in which chunk.
  productionBrowserSourceMaps: process.env.NEXT_SOURCE_MAPS === '1',
  experimental: {
    // The on-disk dev cache grew past 1.5 GB during heavy editing and then failed to restore,
    // which aborts the dev server. A cold compile is slower to start but cannot do that.
    turbopackFileSystemCacheForDev: false,
  },
  async rewrites() {
    // Stable short URLs for the dev-only workbenches.
    return [
      { source: '/__ui', destination: '/dev/ui' },
      { source: '/__world', destination: '/dev/world' },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // The worker and its file list must be re-read on every visit, or an update never arrives.
        source: '/:file(sw.js|sw-manifest.js)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Icons and models keep their names between builds, so a week, then check again.
        source: '/:folder(icons|models)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
