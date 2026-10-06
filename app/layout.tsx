import '@/styles/fonts';
import '@/styles/index.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RootLayout } from '@/app/layouts/RootLayout';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f0fdf4',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootLayout>{children}</RootLayout>
        <noscript>{BRAND.name} needs JavaScript to grow your tree.</noscript>
      </body>
    </html>
  );
}
