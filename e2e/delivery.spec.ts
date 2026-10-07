import { expect, test } from './support/test';

/** What the server tells browsers and crawlers, read from the production build. */

test.describe('security headers', () => {
  for (const path of ['/', '/today', '/api/status', '/sw.js']) {
    test(`${path} carries them`, async ({ request }) => {
      const headers = (await request.get(path)).headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toContain('camera=()');
      expect(headers['strict-transport-security']).toContain('max-age=');
      expect(headers['x-powered-by']).toBeUndefined();
      const policy = headers['content-security-policy'] ?? '';
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("object-src 'none'");
    });
  }

  test('the service worker is never cached by the browser', async ({ request }) => {
    for (const path of ['/sw.js', '/sw-manifest.js']) {
      const response = await request.get(path);
      expect(response.headers()['cache-control']).toContain('no-cache');
      expect(response.headers()['content-type']).toContain('javascript');
    }
  });
});

test.describe('search and sharing', () => {
  test('robots.txt keeps crawlers out of the app and points to the sitemap', async ({
    request,
  }) => {
    const text = await (await request.get('/robots.txt')).text();
    expect(text).toContain('Disallow: /api/');
    expect(text).toContain('Disallow: /today');
    expect(text).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  });

  test('sitemap.xml lists the public pages and only those', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const path of ['', '/methodology', '/privacy', '/demo']) {
      expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+${path}</loc>`));
    }
    expect(xml).not.toContain('/today');
    expect(xml).not.toContain('/api');
  });

  test('the landing page has a canonical address and share tags with an image', async ({
    page,
  }) => {
    await page.goto('/');
    const meta = async (selector: string) => page.locator(selector).first().getAttribute('content');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https?:\/\/[^/]+\/$/,
    );
    expect(await meta('meta[property="og:title"]')).toContain('Touch Grass');
    expect(await meta('meta[property="og:description"]')).toBeTruthy();
    expect(await meta('meta[property="og:image"]')).toMatch(/^https?:\/\/.+\.(png|jpg)/);
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await meta('meta[name="twitter:image"]')).toMatch(/^https?:\/\/.+\.(png|jpg)/);

    const image = await page.request.get((await meta('meta[property="og:image"]')) ?? '');
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toMatch(/image\/(png|jpeg)/);
  });

  test('every public page has its own title and description', async ({ page }) => {
    const titles = new Set<string>();
    for (const path of ['/', '/methodology', '/privacy', '/demo']) {
      await page.goto(path);
      titles.add(await page.title());
      expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
      expect(await page.title()).not.toMatch(/ecoquest/i);
    }
    expect(titles.size).toBe(4);
  });
});
