import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

/** The pages anyone can open without a saved tree. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const page = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly') => ({
    url: new URL(path, base).toString(),
    changeFrequency,
    priority,
  });
  return [
    page('/', 1, 'weekly'),
    page('/demo', 0.8, 'monthly'),
    page('/methodology', 0.7, 'monthly'),
    page('/privacy', 0.4, 'monthly'),
  ];
}
