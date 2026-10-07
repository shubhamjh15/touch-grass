import type { Page } from '@playwright/test';
import { expect, ready, test, visit } from './support/test';
import { tabTo } from './support/keyboard';
import { editedFixture, seeded, storageOf } from './support/seeds';
import {
  contextsEverMade,
  drawsWithin,
  liveContexts,
  recordRequests,
  sceneChunks,
  sceneReady,
  watchFirstPaint,
} from './support/world';

/**
 * The 3D world from the outside. With WebGL the scene reaches "ready", answers a log and
 * opens full screen; without it (or with graphics off) the illustrated tree stands in, no
 * scene is built and the three.js chunk is never asked for. The chunk is also kept out of
 * every route's requests before first paint, and a scene that nobody can see stops drawing.
 */

const growthOf = async (page: Page): Promise<number> =>
  Number(await page.locator('[data-world-growth]').first().getAttribute('data-world-growth'));

/** "Explore the island" on Today, pressed from the keyboard: the island opens full screen with its landmarks as buttons. */
async function enterExplore(page: Page, options: { tab: boolean } = { tab: true }): Promise<void> {
  const open = page.getByRole('button', { name: /^Explore( the island)?$/ });
  // With the scene drawing in software every key press is slow, so that run starts from the button.
  if (options.tab) await tabTo(page, open, { limit: 150 });
  else await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Explore your island' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Close/ })).toBeFocused();
}

test.describe('with WebGL', () => {
  test.use({ storageState: seeded('day12'), webgl: true });
  // The scene is drawn in software here: every frame, and so every key press, is slow.
  test.beforeEach(() => {
    test.slow();
  });

  test('Today reaches ready with one context and no errors', async ({ page }) => {
    await visit(page, '/today');
    await sceneReady(page);
    await expect.poll(() => liveContexts(page)).toBe(1);
    await expect(page.locator('[data-world-stage]').first()).toBeVisible();
    expect(sceneChunks().length).toBeGreaterThan(0);
  });

  test('a log changes the growth value the stage carries, and the scene survives it', async ({
    page,
  }) => {
    await visit(page, '/log');
    await sceneReady(page);
    const before = await growthOf(page);
    await page.getByRole('button', { name: /^Short shower/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Stick (it|\d+) on$/ })
      .click();
    await expect.poll(() => growthOf(page)).toBeGreaterThan(before);
    await expect(page.locator('html')).toHaveAttribute('data-world', 'ready');
    await expect.poll(() => liveContexts(page)).toBe(1);
  });

  test('moving between pages keeps the one scene and one context', async ({ page }) => {
    await visit(page, '/today');
    await sceneReady(page);
    // On a phone the Log tab is the green sticker, whose spoken name is "Log an action".
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: /^Log( an action)?$/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/log$/);
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-world', 'ready');
    await expect.poll(() => liveContexts(page)).toBe(1);
  });

  test('Explore opens full screen, focuses its close button and gives the focus back', async ({
    page,
  }) => {
    await visit(page, '/me?tab=island');
    await sceneReady(page);
    const open = page.getByRole('button', { name: /Explore/ }).first();
    await expect(open).toBeVisible();
    await open.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Explore your island' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Close/ })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();

    // And by its button.
    await open.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Close/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test('its landmarks can be reached and used from the keyboard', async ({ page }) => {
    await visit(page, '/today');
    await sceneReady(page);
    await enterExplore(page, { tab: false });
    const quests = page.locator('[data-landmark="quests"]').filter({ visible: true }).first();
    await tabTo(page, quests, { limit: 40 });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/quests$/);
  });

  test('a scene scrolled out of sight stops drawing', async ({ page }) => {
    await visit(page, '/today');
    await sceneReady(page);
    expect(await drawsWithin(page, 1500)).toBeGreaterThan(0);

    // Open a page whose stage can be left behind.
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '6000px';
      document.body.append(spacer);
      window.scrollTo(0, 6000);
    });
    await expect.poll(() => drawsWithin(page, 600), { timeout: 15_000 }).toBeLessThanOrEqual(2);
  });
});

test.describe('the stage and the app without 3D', () => {
  test.describe('a browser that has no WebGL', () => {
    test.use({ storageState: seeded('day12') });

    test('shows the illustrated tree, builds no scene and asks for no 3D code', async ({
      page,
    }) => {
      const requests = recordRequests(page);
      await visit(page, '/today');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'fallback');
      await expect(page.locator('[data-world-fallback]').first()).toBeVisible();
      expect(await contextsEverMade(page)).toBe(0);
      expect(await page.locator('[data-world-stage] canvas').count()).toBe(0);
      expect(requests.sceneRequested()).toBe(false);
      // The stage is still described to a screen reader, and exploring it makes the landmarks buttons.
      await expect(page.locator('[data-world-stage]').first()).toHaveAttribute('role', 'group');
      await enterExplore(page);
      await expect(page.locator('[data-landmark]').filter({ visible: true })).toHaveCount(7);
    });

    const landmarks: Array<[string, RegExp]> = [
      ['log', /\/log$/],
      ['quests', /\/quests$/],
      ['learn', /\/learn$/],
      ['impact', /\/impact$/],
      ['community', /\/community$/],
      ['me', /\/me/],
    ];
    test('the coach landmark opens Moss', async ({ page }) => {
      await visit(page, '/today');
      await enterExplore(page);
      const chip = page.locator('[data-landmark="coach"]').filter({ visible: true });
      await tabTo(page, chip, { limit: 40 });
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: /Moss/ })).toBeVisible();
    });

    for (const [landmark, url] of landmarks) {
      test(`the ${landmark} landmark is reachable by keyboard and leads there`, async ({
        page,
      }) => {
        await visit(page, '/today');
        await enterExplore(page);
        const chip = page.locator(`[data-landmark="${landmark}"]`).filter({ visible: true });
        await tabTo(page, chip, { limit: 40 });
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(url);
      });
    }

    test('Explore still opens, as the illustrated island, and closes with Escape', async ({
      page,
    }) => {
      await visit(page, '/me?tab=island');
      await page
        .getByRole('button', { name: /Explore/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Explore your island' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('The 3D view is off');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });
  });

  test.describe('graphics set to off, in a browser that could draw', () => {
    test.use({
      webgl: true,
      storageState: storageOf(
        editedFixture('day12', (state) => {
          state.settings.graphics = 'off';
        }),
      ),
    });

    test('keeps the illustration, leaves no live context and never requests three.js', async ({
      page,
    }) => {
      const requests = recordRequests(page);
      await visit(page, '/today');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'fallback');
      await expect(page.locator('[data-world-fallback]').first()).toBeVisible();
      await expect.poll(() => liveContexts(page)).toBe(0);
      expect(await page.locator('[data-world-stage] canvas').count()).toBe(0);
      // Let anything lazy that was going to load, load.
      await page.waitForLoadState('networkidle');
      expect(requests.sceneRequested()).toBe(false);
    });

    test('the setting can be turned back on and the scene comes up', async ({ page }) => {
      await visit(page, '/me?tab=settings');
      await page.getByRole('combobox', { name: '3D quality' }).click();
      await page.getByRole('option', { name: 'Low', exact: true }).click();
      await sceneReady(page);
      await expect.poll(() => liveContexts(page)).toBe(1);
    });
  });
});

test.describe('the 3D chunk is not part of any first paint', () => {
  test.use({ webgl: true });

  const pages: Array<{ path: string; state: 'fresh' | 'day12' }> = [
    { path: '/', state: 'fresh' },
    { path: '/start', state: 'fresh' },
    { path: '/demo', state: 'fresh' },
    { path: '/methodology', state: 'fresh' },
    { path: '/privacy', state: 'fresh' },
    { path: '/today', state: 'day12' },
    { path: '/log', state: 'day12' },
    { path: '/quests', state: 'day12' },
    { path: '/learn', state: 'day12' },
    { path: '/impact', state: 'day12' },
    { path: '/community', state: 'day12' },
    { path: '/coach', state: 'day12' },
    { path: '/me', state: 'day12' },
  ];

  for (const entry of pages) {
    test.describe(entry.path, () => {
      test.use({ storageState: seeded(entry.state) });

      test('is requested only after the page has painted', async ({ page }) => {
        const watch = await watchFirstPaint(page);
        await visit(page, entry.path);
        await expect.poll(() => watch.painted(), { timeout: 30_000 }).toBe(true);
        expect(watch.sceneBeforePaint()).toEqual([]);
      });
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ storageState: seeded('day12'), webgl: true, reducedMotion: 'reduce' });

  test('the world stays and the app stays fully usable', async ({ page }) => {
    await visit(page, '/today');
    await sceneReady(page);
    await page.getByRole('region', { name: 'Stick one on' }).getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: /^Stick (it|\d+) on$/ }).click();
      await expect(dialog).toHaveCount(0);
    }
    await expect(page.locator('html')).toHaveAttribute('data-world', 'ready');
    const before = await growthOf(page);
    expect(before).toBeGreaterThan(0);
  });
});
