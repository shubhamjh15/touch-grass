import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A production build can run next to the dev server (tests, checks) by pointing
  // it at its own output folder: NEXT_DIST_DIR=.next-check next build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    // Stable short URLs for the dev-only workbenches.
    return [
      { source: '/__ui', destination: '/dev/ui' },
      { source: '/__world', destination: '/dev/world' },
    ];
  },
};

export default nextConfig;
