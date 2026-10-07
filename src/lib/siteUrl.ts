/**
 * The address the site is served from, for absolute URLs in metadata, the sitemap and share cards.
 * Set `NEXT_PUBLIC_SITE_URL` on a custom domain; on Vercel the production domain is picked up.
 */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = configured
    ? configured
    : vercel
      ? `https://${vercel}`
      : `http://localhost:${process.env.PORT ?? '5173'}`;
  return new URL(origin.startsWith('http') ? origin : `https://${origin}`);
}
