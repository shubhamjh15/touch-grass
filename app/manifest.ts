import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/** The web app manifest: what makes the product installable. Icons come from `scripts/build-icons.mjs`. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: 'en',
    dir: 'ltr',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f0fdf4',
    theme_color: '#f0fdf4',
    categories: ['lifestyle', 'health', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: 'Log an action',
        short_name: 'Log',
        url: '/log',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Touch grass break',
        short_name: 'Break',
        url: '/today?break=1',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Ask Moss',
        short_name: 'Moss',
        url: '/today?coach=1',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
