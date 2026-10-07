import type { Page } from '@playwright/test';
import { expect, ready, test, visit, NEXT_MORNING } from './support/test';
import { savedGame } from './support/app';
import { seeded } from './support/seeds';

/**
 * The privacy page, the install hint and the landing FAQ all say the app opens without a
 * network. This is the proof: load the production build, cut the network, reload, open a page
 * that was never visited, and log an action.
 */

test.use({ storageState: seeded('day12'), now: NEXT_MORNING, serviceWorkers: 'allow' });

/** Waits until the worker has stored the whole build and controls this page. */
async function workerReady(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      message: 'the worker takes control of the page',
    })
    .toBe(true);
}

test.beforeEach(({ health }) => {
  // Cutting the network is the point of the test: what the browser could not fetch is expected.
  health.allow(/request failed/);
  health.allow(/Failed to fetch|Failed to load resource|net::ERR_INTERNET_DISCONNECTED/);
});

test('a reload without a network opens the app, and an action can still be logged', async ({
  page,
  context,
}) => {
  await visit(page, '/today');
  await workerReady(page);

  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  // A page this tab never opened while online.
  await page.goto('/log');
  await ready(page);
  const before = (await savedGame(page)).logs.length;

  await page.getByRole('button', { name: /^Walk or bike/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('10 km', { exact: true }).click();
  await dialog.getByRole('button', { name: /^Stick (it|\d+) on$/ }).click();
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Stuck.' }).first(),
  ).toBeVisible();
  await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before + 1);

  // The save survives another cold load, still offline.
  await page.reload();
  await ready(page);
  expect((await savedGame(page)).logs.length).toBe(before + 1);
});

test('a lesson and the public pages open offline too', async ({ page, context }) => {
  await visit(page, '/today');
  await workerReady(page);
  await context.setOffline(true);

  await page.goto('/learn');
  await ready(page);
  const lessonHref = await page.locator('a[href^="/learn/"]').first().getAttribute('href');
  expect(lessonHref).toMatch(/^\/learn\/[a-z0-9-]+$/);
  await page.goto(lessonHref ?? '/learn');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  for (const path of ['/methodology', '/privacy', '/']) {
    await page.goto(path);
    await ready(page);
  }
});

test('the worker keeps the API out of its cache and leaves other origins alone', async ({
  page,
  context,
}) => {
  await visit(page, '/today');
  await workerReady(page);

  const stored = await page.evaluate(async () => {
    const urls: string[] = [];
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return { urls, names };
  });
  expect(stored.names.some((name) => name.startsWith('touchgrass-shell-'))).toBe(true);
  expect(stored.urls.filter((path) => path.startsWith('/api/'))).toEqual([]);
  // Pages, the script and style files of the build, and the installable manifest are all in.
  for (const path of ['/', '/today', '/log', '/privacy', '/manifest.webmanifest']) {
    expect(stored.urls).toContain(path);
  }
  expect(stored.urls.filter((path) => path.startsWith('/_next/static/')).length).toBeGreaterThan(
    10,
  );

  await context.setOffline(true);
  const api = await page.evaluate(() =>
    fetch('/api/status').then(
      () => 'answered',
      () => 'failed',
    ),
  );
  expect(api).toBe('failed');
});

test('the manifest makes the app installable', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Touch Grass');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/today');
  expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
});
