import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

/**
 * The public pages are for search engines; the app's own pages need a tree planted on the
 * visitor's device and only redirect without one, so they are left out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/methodology', '/privacy', '/demo'],
      disallow: [
        '/api/',
        '/dev/',
        '/start',
        '/today',
        '/log',
        '/quests',
        '/learn',
        '/impact',
        '/community',
        '/coach',
        '/me',
      ],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
    host: siteUrl().origin,
  };
}
