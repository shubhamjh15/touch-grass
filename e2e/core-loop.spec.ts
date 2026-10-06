import type { Locator, Page } from '@playwright/test';
import { expect, ready, test, visit, NEXT_MORNING } from './support/test';
import { holdClock, readHud, savedGame } from './support/app';
import { GP_CHECK_IN, XP_CHECK_IN } from '../src/game/economy';
import { levelInfo } from '../src/game/levels';
import { GAME_KEY, seeded } from './support/seeds';

/**
 * The loop the product is about: log a real action, see the honest estimate, watch level,
 * streak, total and the tree answer, and take it back with Undo. Everything is read twice,
 * from the page a person sees and from the save a reload would read.
 */

test.use({ storageState: seeded('day12'), now: NEXT_MORNING });

const sheet = (page: Page): Locator => page.getByRole('dialog');

/** Opens a sticker's sheet and picks one of its amounts. */
async function openSticker(page: Page, tile: RegExp, amount?: string): Promise<Locator> {
  await page.getByRole('button', { name: tile }).click();
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  if (amount) await dialog.getByText(amount, { exact: true }).click();
  return dialog;
}

async function stick(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: /^Stick (it|\d+) on$/ }).click();
}

/** The toast that confirms a log (others, like a ready quest, may be stacked beside it). */
const toast = (page: Page): Locator =>
  page.locator('[data-sonner-toast]').filter({ hasText: 'Stuck.' }).first();

async function growthOf(page: Page): Promise<number> {
  const stage = page.locator('[data-world-growth]').first();
  return Number(await stage.getAttribute('data-world-growth'));
}

test.describe('logging with a quantity', () => {
  test('moves XP, streak, total and the tree, in the page and in the save', async ({ page }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    const hudBefore = await readHud(page);
    const growthBefore = await growthOf(page);

    const dialog = await openSticker(page, /^Walk or bike/, '10 km');
    // The honest estimate is on the sheet before anything is stuck on.
    await expect(dialog).toContainText('approximately');
    await expect(dialog).toContainText('avoided');
    await expect(dialog.getByRole('link', { name: 'How we estimate this' })).toHaveAttribute(
      'href',
      /\/methodology#action-walk-cycle-instead-of-car/,
    );
    await stick(dialog);

    await expect(toast(page)).toContainText('Stuck.');
    await expect(toast(page)).toContainText('approximately');

    const after = await savedGame(page);
    const entry = after.logs.at(-1);
    expect(after.logs).toHaveLength(before.logs.length + 1);
    expect(entry).toMatchObject({
      actionId: 'walk-cycle-instead-of-car',
      qty: 10,
      unit: 'km',
      day: '2026-10-07',
    });
    expect(entry?.co2eKg).toBeGreaterThan(0);
    expect(after.xp).toBeGreaterThan(before.xp);
    expect(after.tree.gp).toBeGreaterThan(before.tree.gp);
    expect(after.streak.current).toBe(before.streak.current + 1);

    const hudAfter = await readHud(page);
    expect(hudAfter.streak).toBe(hudBefore.streak + 1);
    if (hudAfter.kg !== null && hudBefore.kg !== null) {
      expect(hudAfter.kg).toBeGreaterThan(hudBefore.kg);
    }
    await expect.poll(() => growthOf(page)).toBeGreaterThan(growthBefore);
  });

  test('shows the new action in today’s ledger with its own Undo', async ({ page }) => {
    await visit(page, '/log');
    // The Undo window is eight seconds of the app's clock; a loaded machine must not eat it.
    await holdClock(page);
    const dialog = await openSticker(page, /^Short shower/);
    await stick(dialog);
    const ledger = page.getByRole('list', { name: 'Actions logged today' });
    await expect(ledger.getByText('Short shower')).toBeVisible();
    await expect(ledger.getByRole('button', { name: 'Undo: Short shower' })).toBeVisible();
  });
});

test.describe('Undo', () => {
  test('takes the log back out and keeps only the day’s check-in', async ({ page }) => {
    await visit(page, '/log');
    await holdClock(page);
    const before = await savedGame(page);
    const hudBefore = await readHud(page);

    const dialog = await openSticker(page, /^Walk or bike/, '5 km');
    await stick(dialog);
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Peeled off. Back to how it was.').first()).toBeVisible();

    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length);
    const after = await savedGame(page);
    // The log's own XP and growth leave with it. Showing up today (the check-in) is never
    // undone: spec section 5, "the check-in itself is never undone".
    expect(after.xp).toBe(before.xp + XP_CHECK_IN);
    expect(after.tree.gp).toBe(before.tree.gp + GP_CHECK_IN);
    expect(after.streak.current).toBe(before.streak.current + 1);
    expect(after.tree.rings).toBe(before.tree.rings + 1);
    expect(after.days['2026-10-07']?.ringClosed).toBe(false);

    const hudAfter = await readHud(page);
    expect(hudAfter.level).toBe(hudBefore.level);
    expect(hudAfter.streak).toBe(hudBefore.streak + 1);
    expect(hudAfter.kg).toBe(hudBefore.kg);
  });

  test('restores XP, growth, total and the tree exactly when the day was already checked in', async ({
    page,
  }) => {
    await visit(page, '/log');
    await holdClock(page);
    const first = await openSticker(page, /^Short shower/);
    await stick(first);
    await expect(first).toHaveCount(0);
    const base = await savedGame(page);
    const hudBase = await readHud(page);
    const growthBase = await growthOf(page);

    const dialog = await openSticker(page, /^Walk or bike/, '5 km');
    await stick(dialog);
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(base.logs.length + 1);
    await expect.poll(() => growthOf(page)).toBeGreaterThan(growthBase);
    // The ledger's own Undo (the toast of the first log may still be on screen).
    await page
      .getByRole('list', { name: 'Actions logged today' })
      .getByRole('button', { name: /^Undo: Walk or bike/ })
      .click();

    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(base.logs.length);
    const after = await savedGame(page);
    expect(after.xp).toBe(base.xp);
    expect(after.tree.gp).toBe(base.tree.gp);
    expect(after.streak.current).toBe(base.streak.current);
    expect(after.tree.rings).toBe(base.tree.rings);
    expect(after.logs.map((entry) => entry.id)).toEqual(base.logs.map((entry) => entry.id));

    const hudAfter = await readHud(page);
    expect(hudAfter).toEqual(hudBase);
    await expect.poll(() => growthOf(page)).toBeCloseTo(growthBase, 4);
  });

  test('stops being offered when its eight seconds are up', async ({ page }) => {
    await visit(page, '/log');
    await holdClock(page);
    const dialog = await openSticker(page, /^Short shower/);
    await stick(dialog);
    const ledger = page.getByRole('list', { name: 'Actions logged today' });
    const undo = ledger.getByRole('button', { name: 'Undo: Short shower' });
    await expect(undo).toBeVisible();
    // Nine seconds pass, all at once.
    const stamped = await page.evaluate(() => Date.now());
    await page.clock.setFixedTime(stamped + 9000);
    await page.clock.runFor(9000);
    await expect(undo).toHaveCount(0);
    // It can still be deleted: that is a deliberate act, not a slip.
    await expect(ledger.getByRole('button', { name: 'Delete: Short shower' })).toBeVisible();
  });
});

test.describe('daily caps', () => {
  test('an action that counts once a day is maxed after one log', async ({ page }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    const dialog = await openSticker(page, /^Standby off/);
    await stick(dialog);
    await expect(toast(page)).toContainText('Stuck.');
    const once = await savedGame(page);
    expect(once.logs).toHaveLength(before.logs.length + 1);

    const tile = page.getByRole('button', { name: /^Standby off.*Maxed for today/ });
    await expect(tile).toBeVisible();
    await tile.click({ force: true });
    const again = sheet(page);
    await expect(again).toContainText('Maxed for today');
    await expect(again.getByRole('button', { name: 'Stick it on' })).toBeDisabled();
    await page.keyboard.press('Escape');
    expect((await savedGame(page)).logs).toHaveLength(once.logs.length);
  });

  test('more than a day can hold is refused before it is logged', async ({ page }) => {
    await visit(page, '/log');
    const dialog = await openSticker(page, /^Walk or bike/, 'Other');
    await dialog.getByRole('textbox', { name: 'Amount' }).fill('90');
    await expect(dialog).toContainText("That's more than a day can hold");
    await expect(dialog.getByRole('button', { name: 'Stick it on' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Amount' }).fill('12');
    await expect(dialog.getByRole('button', { name: 'Stick it on' })).toBeEnabled();
  });

  test('XP stops at the daily limit while kilograms keep counting', async ({ page }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    // Three plant-based meals is the day's limit for that action.
    for (let meal = 0; meal < 3; meal += 1) {
      const dialog = await openSticker(page, /^Plant-based meal/);
      await stick(dialog);
      await expect
        .poll(async () => (await savedGame(page)).logs.length)
        .toBe(before.logs.length + meal + 1);
      await expect(dialog).toHaveCount(0);
    }
    const full = await savedGame(page);
    expect(full.logs.length).toBe(before.logs.length + 3);
    await expect(
      page.getByRole('button', { name: /^Plant-based meal.*Maxed for today/ }),
    ).toBeVisible();
  });
});

test.describe('something else', () => {
  test('a sentence is matched to the catalogue by the built-in list, with a quantity', async ({
    page,
  }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    await page.getByRole('button', { name: /^Say it in your own words/ }).click();
    const dialog = sheet(page);
    await dialog.getByRole('textbox', { name: 'What did you do?' }).fill('I cycled 6 km to work');
    await dialog.getByRole('button', { name: 'Find my actions' }).click();

    await expect(
      dialog.getByRole('heading', { name: 'Here is what that sounds like.' }),
    ).toBeVisible();
    await expect(dialog).toContainText('matched by the built-in list');
    await expect(dialog.getByRole('checkbox', { name: /Walked or cycled/ })).toBeChecked();
    await expect(dialog).toContainText('6 km');
    // Nothing is logged until the person says so.
    expect((await savedGame(page)).logs).toHaveLength(before.logs.length);

    await stick(dialog);
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);
    expect((await savedGame(page)).logs.at(-1)).toMatchObject({
      actionId: 'walk-cycle-instead-of-car',
      qty: 6,
    });
  });

  test('custom: a close match is offered first, and a true custom action earns XP without a made-up number', async ({
    page,
  }) => {
    await visit(page, '/log');
    const before = await savedGame(page);
    await page.getByRole('button', { name: 'Log a custom action' }).click();
    const dialog = sheet(page);
    await dialog.getByRole('textbox', { name: 'What did you do?' }).fill('Gave away my old couch');
    await expect(dialog).toContainText('only when an AI coach is set up');
    await dialog.getByRole('button', { name: 'Look it up' }).click();

    // The built-in list recognises it first.
    await expect(dialog.getByText('Looks like something on the sheet.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Passed it on/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'No, something else' }).click();

    // No AI key on this server: by hand, with no invented kilograms.
    await expect(dialog.getByRole('heading', { name: 'Check it over' })).toBeVisible();
    await expect(dialog).toContainText(
      'No live AI on this server, so there is no kilogram figure.',
    );
    await expect(dialog).toContainText('Impact not quantified. XP for showing up.');
    await dialog.getByRole('button', { name: 'Stick it on' }).click();

    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);
    const after = await savedGame(page);
    const entry = after.logs.at(-1);
    expect(entry?.kind).toBe('unrated');
    expect(entry?.co2eKg ?? null).toBeNull();
    expect(after.xp).toBeGreaterThan(before.xp);
  });

  test('a custom action can be kept in My actions for one tap next time', async ({ page }) => {
    await visit(page, '/log');
    await page.getByRole('button', { name: 'Log a custom action' }).click();
    const dialog = sheet(page);
    await dialog.getByRole('textbox', { name: 'What did you do?' }).fill('Mended a tent');
    await dialog.getByRole('button', { name: 'Look it up' }).click();
    const nothingClose = dialog.getByRole('button', { name: 'No, something else' });
    if (await nothingClose.isVisible()) await nothingClose.click();
    await dialog.getByRole('checkbox', { name: /Keep in My actions/ }).check();
    await dialog.getByRole('button', { name: 'Stick it on' }).click();
    await expect
      .poll(async () => (await savedGame(page)).customActions.map((action) => action.title))
      .toContain('Mended a tent');
  });
});

test.describe('the same loop from Today', () => {
  test('a quick sticker on Today logs and moves the ring', async ({ page }) => {
    await visit(page, '/today');
    const before = await savedGame(page);
    await page
      .getByRole('region', { name: 'Stick one on' })
      .getByRole('button', { name: 'Veggie meal' })
      .click();
    const dialog = sheet(page);
    if (await dialog.isVisible()) await stick(dialog);
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);
    expect((await savedGame(page)).days['2026-10-07']).toBeDefined();
  });
});

test.describe('a level-up', () => {
  test('shows in the HUD and in the save', async ({ page }) => {
    await visit(page, '/log');
    // Move the saved XP to five short of the next level (the gap comes from the save, so it
    // reads the same on a phone, whose bar shows no XP count), then look again.
    const start = levelInfo((await savedGame(page)).xp);
    await page.evaluate(
      ([key, gap]) => {
        const file = JSON.parse(localStorage.getItem(key) ?? '{}') as { state: { xp: number } };
        file.state.xp += Number(gap);
        localStorage.setItem(key, JSON.stringify(file));
      },
      [GAME_KEY, start.xpToNext - 5] as const,
    );
    await page.reload();
    await ready(page);
    const hudBefore = await readHud(page);
    expect(hudBefore.level).toBe(start.level);

    const dialog = await openSticker(page, /^Walk or bike/, '10 km');
    await stick(dialog);
    await expect.poll(async () => (await readHud(page)).level).toBe(start.level + 1);
    expect(levelInfo((await savedGame(page)).xp).level).toBe(start.level + 1);
  });
});
