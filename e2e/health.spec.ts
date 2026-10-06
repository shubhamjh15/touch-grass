import type { Page } from '@playwright/test';
import { expect, ready, test, visit } from './support/test';
import { APP_ROUTES, PUBLIC_ROUTES } from './support/routes';
import { seeded } from './support/seeds';

/**
 * Nothing on any route may log a console error, throw, ask a third party for anything or get
 * an error response. The monitor lives in `support/test.ts` and fails the test itself; these
 * specs only have to visit, scroll through and settle each route, in a fresh state and a rich one.
 */

async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(400, Math.floor(height / 6));
  for (let top = 0; top <= height; top += step) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe('a fresh visitor', () => {
  test.use({ storageState: seeded('fresh') });

  for (const route of [
    { path: '/', title: 'Landing' },
    ...PUBLIC_ROUTES,
    { path: '/demo', title: 'Demo' },
  ]) {
    test(`${route.path} is quiet`, async ({ page }) => {
      await visit(page, route.path);
      await scrollThrough(page);
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }

  test('/start is quiet', async ({ page }) => {
    await visit(page, '/start');
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

for (const state of ['day12', 'day200'] as const) {
  test.describe(`a tree at ${state}`, () => {
    test.use({ storageState: seeded(state) });

    for (const route of APP_ROUTES) {
      test(`${route.path} is quiet`, async ({ page }) => {
        await visit(page, route.path);
        await scrollThrough(page);
        await expect(page.locator('h1')).toHaveCount(1);
      });
    }

    test('the methodology and privacy pages are quiet', async ({ page }) => {
      for (const route of PUBLIC_ROUTES) {
        await visit(page, route.path);
        await scrollThrough(page);
      }
    });

    test('a lesson is quiet', async ({ page }) => {
      await visit(page, '/learn/the-blanket');
      await scrollThrough(page);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}

test.describe('every request stays on this origin', () => {
  test.use({ storageState: seeded('day12') });

  test('a walk through the app asks nobody else for anything', async ({ page, context }) => {
    const hosts = new Set<string>();
    context.on('request', (request) => {
      if (/^https?:/.test(request.url())) hosts.add(new URL(request.url()).host);
    });
    for (const route of APP_ROUTES) {
      await visit(page, route.path);
      await ready(page);
    }
    expect([...hosts]).toEqual(['localhost:4173']);
  });
});
