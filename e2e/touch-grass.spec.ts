import type { Page } from '@playwright/test';
import { expect, test, visit } from './support/test';
import { savedGame } from './support/app';
import { seeded } from './support/seeds';
import { XP_BREAK_SHORT } from '../src/game/economy';

/**
 * The Touch Grass break pays for time away from the screen. The page cannot know where a
 * person went, only that it was hidden: the specs leave and return by hiding the page the
 * way a phone does when it is locked, and move the clock instead of waiting.
 */

test.use({ storageState: seeded('day12') });

async function showPage(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => next });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => next === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

async function startBreak(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start a break' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start the break' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Back at');
}

test.describe('a break that is kept', () => {
  test('leaving the page and coming back after the time is up pays once and starts the wait', async ({
    page,
  }) => {
    await visit(page, '/today');
    const before = await savedGame(page);
    await startBreak(page);
    await expect.poll(async () => (await savedGame(page)).activeBreak).not.toBeNull();

    await showPage(page, 'hidden');
    await page.clock.fastForward('10:30');
    await showPage(page, 'visible');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Time's up.");
    await page.getByRole('button', { name: "I'm back" }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Welcome back. How was the sky?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Went outside' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('10 minutes, kept.');
    await expect(page.getByText('Touched grass', { exact: true })).toBeVisible();
    await expect(
      page.getByText(`+${XP_BREAK_SHORT} XP · `, { exact: false }).first(),
    ).toBeVisible();

    await expect
      .poll(async () => (await savedGame(page)).breaks.length)
      .toBe(before.breaks.length + 1);
    const after = await savedGame(page);
    expect(after.activeBreak).toBeNull();
    expect(after.breaks.at(-1)).toMatchObject({ kept: true, plannedMin: 10 });
    // The break pays its own XP; a first break may also earn a badge on top.
    expect(after.xp).toBeGreaterThanOrEqual(before.xp + XP_BREAK_SHORT);

    // The note is optional and goes to the journal on this device.
    await page.getByRole('textbox', { name: /Notice one thing/ }).fill('A kite over the roofs');
    await page.getByRole('button', { name: 'Save the note' }).click();
    await expect(page.getByText('Saved to your journal.')).toBeVisible();
    await expect
      .poll(async () => (await savedGame(page)).journal.map((note) => note.text))
      .toContain('A kite over the roofs');

    await page.getByRole('button', { name: 'Back to the grove' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/\w/);
    await expect(page.getByRole('button', { name: 'Start a break' })).toBeDisabled();
    await expect(page.getByText(/Next break in \d+ min/).first()).toBeVisible();
  });

  test('a break in progress survives a reload and still shows the return time', async ({
    page,
  }) => {
    await visit(page, '/today');
    await startBreak(page);
    const title = await page.getByRole('heading', { level: 1 }).textContent();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title ?? '');
    await expect(page.getByRole('button', { name: "I'm back" })).toBeVisible();
  });
});

test.describe('a break that is not', () => {
  test('ending a break after two minutes records nothing and says it kindly', async ({ page }) => {
    await visit(page, '/today');
    const before = await savedGame(page);
    await startBreak(page);
    await showPage(page, 'hidden');
    await page.clock.fastForward('02:00');
    await showPage(page, 'visible');
    await page.getByRole('button', { name: 'End early' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Back already.');
    await expect(
      page.getByRole('status').filter({ hasText: 'Even two minutes is nice' }),
    ).toBeVisible();
    await expect.poll(async () => (await savedGame(page)).activeBreak).toBeNull();
    const after = await savedGame(page);
    expect(after.breaks.filter((entry) => entry.kept)).toHaveLength(
      before.breaks.filter((entry) => entry.kept).length,
    );
    expect(after.xp).toBe(before.xp);
  });

  test('staying at the screen for the whole break is not counted', async ({ page }) => {
    await visit(page, '/today');
    const before = await savedGame(page);
    await startBreak(page);
    // Someone is using the page the whole time: an input every half minute.
    for (let step = 0; step < 21; step += 1) {
      await page.clock.fastForward('00:30');
      await page.mouse.move(100 + step, 120);
      await page.keyboard.press('Shift');
    }
    await page.getByRole('button', { name: "I'm back" }).click();
    await page.getByRole('button', { name: 'Went outside' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Back already.');
    await expect(page.getByRole('status').filter({ hasText: "isn't counted" })).toBeVisible();
    const after = await savedGame(page);
    expect(after.xp).toBe(before.xp);
    expect(after.breaks.at(-1)?.kept ?? false).toBe(false);
  });
});
