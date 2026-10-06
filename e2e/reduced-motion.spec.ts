import { expect, ready, test, visit } from './support/test';
import { plantTree, savedGame } from './support/app';
import { seeded } from './support/seeds';

/**
 * Someone who asked their device for less motion still gets the whole product: the first
 * run, logging and the coach all work, nothing waits for an animation, and the page is still
 * the same page.
 */

test.use({ reducedMotion: 'reduce' });

test.describe('first run', () => {
  test.use({ storageState: seeded('fresh') });

  test('planting a tree works and lands on Today', async ({ page }) => {
    await visit(page, '/start');
    await plantTree(page, { quiz: false, treeName: 'Calm' });
    await ready(page);
    expect((await savedGame(page)).profile.treeName).toBe('Calm');
    await expect(page.getByRole('progressbar', { name: "Today's ring" })).toBeVisible();
  });

  test('the landing demo still grows a tree', async ({ page }) => {
    await visit(page, '/');
    const readout = page.getByRole('group', { name: 'What the demo printed' });
    await readout.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Plant-based lunch' }).click();
    await expect(readout.getByRole('status')).toContainText('Demo tree:');
  });
});

test.describe('a lived-in tree', () => {
  test.use({ storageState: seeded('day12') });

  test('logging, the coach and Explore all work', async ({ page }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    await page.getByRole('button', { name: /^Short shower/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Stick (it|\d+) on$/ })
      .click();
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);

    await visit(page, '/coach');
    await page.getByRole('textbox', { name: 'Message Moss' }).fill('Explain my numbers');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(
      page.getByRole('list', { name: 'Conversation with Moss' }).getByRole('article').last(),
    ).toContainText('Built-in answer', { timeout: 30_000 });

    await visit(page, '/me?tab=island');
    await page
      .getByRole('button', { name: /Explore/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Explore your island' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Explore your island' })).toHaveCount(0);
  });
});
