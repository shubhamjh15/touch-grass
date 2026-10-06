import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, ready, test, visit } from './support/test';
import { savedGame } from './support/app';
import { tabTo } from './support/keyboard';
import { APP_ROUTES, PUBLIC_ROUTES } from './support/routes';
import { seeded } from './support/seeds';

/**
 * WCAG 2.2 AA through axe on every route, in a fresh state and a lived-in one, then the two
 * things a scanner cannot judge: that the first-run flow and logging can be done with a
 * keyboard alone, and that the world's landmarks are reachable that way.
 */

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 4)
          .map(
            (node) =>
              `    ${node.target.join(' ')}\n      ${node.failureSummary?.split('\n')[1] ?? ''}`,
          )
          .join('\n'),
    );
}

test.describe('a fresh visitor', () => {
  test.use({ storageState: seeded('fresh') });

  for (const route of [
    { path: '/', title: 'landing' },
    { path: '/start', title: 'onboarding' },
    { path: '/demo', title: 'demo world' },
    ...PUBLIC_ROUTES,
  ]) {
    test(`${route.path} has no serious or critical violations`, async ({ page }) => {
      await visit(page, route.path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test('the 404 page has none either', async ({ page, health }) => {
    health.allow(/404/);
    await page.goto('/no-such-place');
    await ready(page);
    expect(await seriousViolations(page)).toEqual([]);
  });
});

for (const state of ['day12', 'day200'] as const) {
  test.describe(`a tree at ${state}`, () => {
    test.use({ storageState: seeded(state) });

    for (const route of APP_ROUTES) {
      test(`${route.path} has no serious or critical violations`, async ({ page }) => {
        await visit(page, route.path);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }

    test('a lesson has none', async ({ page }) => {
      await visit(page, '/learn/big-levers');
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}

test.describe('open sheets and dialogs', () => {
  test.use({ storageState: seeded('day12') });

  test('the log sheet and the coach drawer have none', async ({ page }) => {
    await visit(page, '/log');
    await page.getByRole('button', { name: /^Walk or bike/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page
      .getByRole('button', { name: /^Ask Moss/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: /Moss/ })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  for (const tab of ['badges', 'island', 'settings', 'data']) {
    test(`the Me ${tab} tab has none`, async ({ page }) => {
      await visit(page, `/me?tab=${tab}`);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  for (const tab of ['journal', 'share', 'challenge', 'team']) {
    test(`the community ${tab} tab has none`, async ({ page }) => {
      await visit(page, `/community?tab=${tab}`);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

test.describe('with the 3D world running', () => {
  test.use({ storageState: seeded('day12'), webgl: true });

  test('Today has none while the scene is on screen', async ({ page }) => {
    await visit(page, '/today');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'ready', { timeout: 60_000 });
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe('keyboard only', () => {
  test.describe('first run', () => {
    test.use({ storageState: seeded('fresh') });

    test('onboarding, from the first button to the planted tree, needs no pointer', async ({
      page,
    }) => {
      await visit(page, '/start');
      const press = async (name: string | RegExp) => {
        const button = page.getByRole('button', { name });
        await tabTo(page, button);
        await page.keyboard.press('Enter');
      };

      await press("Let's plant");
      const name = page.getByRole('textbox', { name: 'Your name' });
      await tabTo(page, name);
      await page.keyboard.type('Kay');
      await press('Next');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick a tree');
      // A group of radios is one Tab stop (the chosen one); the arrow keys move within it.
      const oak = page.getByRole('radio', { name: /Oak/ });
      await tabTo(page, oak);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      const pine = page.getByRole('radio', { name: /Pine/ });
      await expect(pine).toBeChecked();
      const treeName = page.getByRole('textbox', { name: /^Name it/ });
      await tabTo(page, treeName);
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Needle');
      await press('Next');

      await press(/^Skip for now/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick up to three.');
      await press('Next');
      await press('Go plant');

      const hold = page.getByRole('button', { name: /^Press and hold to plant Needle/ });
      await tabTo(page, hold);
      await page.keyboard.down('Space');
      await page.clock.runFor(2000);
      await page.keyboard.up('Space');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Needle is planted.');

      const next = page.getByRole('button', { name: 'Give Needle its first leaf' });
      await expect(next).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/today$/);
      const saved = await savedGame(page);
      expect(saved.profile).toMatchObject({ name: 'Kay', treeName: 'Needle', species: 'pine' });
    });
  });

  test.describe('logging', () => {
    test.use({ storageState: seeded('day12') });

    test('an action can be found, opened, stuck on and left, from the keyboard', async ({
      page,
    }) => {
      await visit(page, '/log');
      const before = await savedGame(page);
      const tile = page.getByRole('button', { name: /^Short shower/ });
      await tabTo(page, tile, { limit: 160 });
      await page.keyboard.press('Enter');

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const stick = dialog.getByRole('button', { name: /^Stick (it|\d+) on$/ });
      await tabTo(page, stick, { limit: 30 });
      await page.keyboard.press('Enter');

      await expect
        .poll(async () => (await savedGame(page)).logs.length)
        .toBe(before.logs.length + 1);
      await expect(dialog).toHaveCount(0);
      // Focus is on something real, not lost to the top of the page.
      const lost = await page.evaluate(() => document.activeElement === document.body);
      expect(lost).toBe(false);
    });

    test('Escape closes the sheet and the focus returns to the tile that opened it', async ({
      page,
    }) => {
      await visit(page, '/log');
      const tile = page.getByRole('button', { name: /^Short shower/ });
      await tabTo(page, tile, { limit: 160 });
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(tile).toBeFocused();
    });

    test('the skip link is the first stop and jumps past the navigation', async ({ page }) => {
      await visit(page, '/quests');
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'Skip to content' });
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });
  });
});
