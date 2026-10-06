import { expect, ready, test, visit } from './support/test';
import { goTo } from './support/nav';
import { APP_ROUTES, LANDING_TITLE, PUBLIC_ROUTES, titleOf } from './support/routes';
import { seeded } from './support/seeds';

test.describe('with a planted tree', () => {
  test.use({ storageState: seeded('day12') });

  test('every destination can be reached from the navigation', async ({ page }) => {
    await visit(page, '/today');
    for (const route of APP_ROUTES.filter((entry) => entry.nav)) {
      await goTo(page, route.nav ?? '');
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await ready(page);
      await expect(page).toHaveTitle(titleOf(route));
    }
    await goTo(page, 'Me');
    await expect(page).toHaveURL(/\/me$/);
    await expect(page).toHaveTitle(titleOf({ title: 'Me' }));
  });

  test('the coach opens from the navigation on every screen size', async ({ page }) => {
    await visit(page, '/today');
    const open = page.getByRole('button', { name: /^Ask Moss/ }).filter({ visible: true });
    await open.first().click();
    await expect(page.getByRole('dialog', { name: /Moss/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Moss/ })).toHaveCount(0);
  });

  for (const route of APP_ROUTES) {
    test(`${route.path} has one h1 and the title "${route.title}"`, async ({ page }) => {
      await visit(page, route.path);
      await expect(page).toHaveTitle(titleOf(route));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
    });
  }

  test('a lesson has one h1 and names itself in the title', async ({ page }) => {
    await visit(page, '/learn/big-levers');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Big levers vs. small gestures');
    await expect(page).toHaveTitle(/Big levers vs\. small gestures · Touch Grass$/);
  });

  test('back and forward walk the history', async ({ page }) => {
    await visit(page, '/today');
    await goTo(page, 'Log');
    await expect(page).toHaveURL(/\/log$/);
    await goTo(page, 'Quests');
    await expect(page).toHaveURL(/\/quests$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/log$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(/\/today$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/log$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/quests$/);
    await expect(page).toHaveTitle(titleOf({ title: 'Quests' }));
  });

  test('the landing page sends someone with a tree to Today', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/today$/);
    await ready(page);
  });
});

test.describe('without a tree', () => {
  test.use({ storageState: seeded('fresh') });

  test('the landing page has one h1 and its own title', async ({ page }) => {
    await visit(page, '/');
    await expect(page).toHaveTitle(LANDING_TITLE);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} is open to anyone, with one h1 and a title`, async ({ page }) => {
      await visit(page, route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page).toHaveTitle(titleOf(route));
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('onboarding has one h1 and a title', async ({ page }) => {
    await visit(page, '/start');
    await expect(page).toHaveTitle(/^Plant your tree · Touch Grass$/);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  for (const route of APP_ROUTES) {
    test(`${route.path} sends a new visitor to plant a tree first`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(/\/start$/);
      await ready(page);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('a new visitor gets the 404 and one way back', async ({ page, health }) => {
    health.allow(/404/);
    const response = await page.goto('/no-such-place');
    expect(response?.status()).toBe(404);
    await ready(page);
    await expect(page).toHaveURL(/\/no-such-place$/);
    await expect(page).toHaveTitle(/^Page not found · Touch Grass$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(/Lost\?/);
    await page.getByRole('link', { name: 'Back to the start' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a nested unknown route is a 404 too', async ({ page, health }) => {
    health.allow(/404/);
    const response = await page.goto('/learn/no-such-lesson/extra/deeper');
    expect(response?.status()).toBe(404);
    await ready(page);
    await expect(page.locator('h1')).toHaveText(/Lost\?/);
  });
});

test.describe('unknown routes for someone with a tree', () => {
  test.use({ storageState: seeded('day12') });

  test('the 404 offers the way back to the grove', async ({ page, health }) => {
    health.allow(/404/);
    const response = await page.goto('/no-such-place');
    expect(response?.status()).toBe(404);
    await ready(page);
    await expect(page.locator('h1')).toHaveText(/Lost\?/);
    await page.getByRole('link', { name: 'Back to the grove' }).click();
    await expect(page).toHaveURL(/\/today$/);
  });

  test('an unknown lesson says so inside the app, not with a crash', async ({ page, health }) => {
    health.allow(/404/);
    await page.goto('/learn/no-such-lesson');
    await ready(page);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
