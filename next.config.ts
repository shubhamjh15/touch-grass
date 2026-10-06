import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A production build can run next to the dev server (tests, checks) by pointing
  // it at its own output folder: NEXT_DIST_DIR=.next-check next build
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
};

export default nextConfig;
