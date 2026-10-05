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
  icons: { icon: '/favicon.svg' },
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
