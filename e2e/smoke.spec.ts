import { expect, test } from '@playwright/test';

test('the app boots without crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
  expect(errors).toEqual([]);
});
