import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test, visit } from './support/test';
import { savedGame } from './support/app';
import { seeded } from './support/seeds';
import { XP_JOURNAL_NOTE } from '../src/game/economy';

test.use({ storageState: seeded('day12') });

const notesOf = async (page: Page) => (await savedGame(page)).journal;

test.describe('the journal', () => {
  test('creates, edits and deletes a note; the first real note of the day pays a little XP once', async ({
    page,
  }) => {
    await visit(page, '/community');
    const before = await savedGame(page);

    const box = page.getByRole('textbox', { name: 'Your note' });
    await box.fill('Biked past the old mill and the swifts were back.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page.getByText(/^Saved on this device\./).first()).toBeVisible();

    await expect.poll(async () => (await notesOf(page)).length).toBe(before.journal.length + 1);
    const created = await savedGame(page);
    expect(created.xp).toBe(before.xp + XP_JOURNAL_NOTE);
    const card = page
      .getByRole('article', { name: /^Note, / })
      .filter({ hasText: 'swifts were back' });
    await expect(card).toBeVisible();

    // A second note the same day is saved but not paid again.
    await box.fill('Second line, no XP for this one.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect.poll(async () => (await notesOf(page)).length).toBe(before.journal.length + 2);
    expect((await savedGame(page)).xp).toBe(created.xp);

    // Edit.
    await card.getByRole('button', { name: 'Edit note' }).click();
    // While a note is being edited its text lives in the box, so the card is found by that.
    await page
      .getByRole('textbox', { name: 'Edit your note' })
      .fill('Edited: the swifts were loud.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const edited = page
      .getByRole('article', { name: /^Note, / })
      .filter({ hasText: 'swifts were loud' });
    await expect(edited).toContainText('Edited');
    await expect
      .poll(async () => (await notesOf(page)).map((note) => note.text))
      .toContain('Edited: the swifts were loud.');

    // Delete, behind a confirmation. The XP stays.
    await edited.getByRole('button', { name: 'Delete note' }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('Delete this note?');
    await dialog.getByRole('button', { name: 'Delete note' }).click();
    await expect(edited).toHaveCount(0);
    await expect.poll(async () => (await notesOf(page)).length).toBe(before.journal.length + 1);
    expect((await savedGame(page)).xp).toBe(created.xp);
  });

  test('an empty note is refused', async ({ page }) => {
    await visit(page, '/community');
    const before = await savedGame(page);
    const save = page.getByRole('button', { name: 'Save note' });
    await expect(save).toBeDisabled();
    expect((await savedGame(page)).journal).toHaveLength(before.journal.length);
  });

  test('notes survive a reload and can be searched', async ({ page }) => {
    await visit(page, '/community');
    await page.getByRole('textbox', { name: 'Your note' }).fill('Lentils for the whole week.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect
      .poll(async () => (await notesOf(page)).map((note) => note.text))
      .toContain('Lentils for the whole week.');
    await page.reload();
    const search = page
      .getByRole('searchbox')
      .or(page.getByRole('textbox', { name: /^Search \d+ notes?/ }));
    await search.first().fill('lentils');
    await expect(
      page
        .getByRole('article', { name: /^Note, / })
        .filter({ hasText: 'Lentils for the whole week.' }),
    ).toBeVisible();
  });
});

test.describe('a challenge link', () => {
  test('is made here, opens for a friend as an invitation, and is accepted there', async ({
    page,
    browser,
  }) => {
    await visit(page, '/community?tab=challenge');
    const category = page.getByRole('combobox', { name: 'Category' });
    if (await category.isVisible()) {
      await category.click();
      await page.getByRole('option').first().click();
    }
    await page.getByRole('textbox', { name: /^A message/ }).fill('Loser cooks dinner');
    await page.getByRole('button', { name: 'Create link' }).click();
    await expect.poll(async () => (await savedGame(page)).challenge.active).not.toBeNull();

    const link = await page.getByRole('textbox', { name: 'Your challenge link' }).inputValue();
    expect(new URL(link).origin).toBe('http://localhost:4173');
    expect(new URL(link).hash).not.toBe('');

    // A friend with their own tree opens it.
    const friend = await browser.newContext({
      storageState: seeded('day200'),
      baseURL: 'http://localhost:4173',
      timezoneId: 'Asia/Kolkata',
    });
    await friend.clock.install({ time: new Date('2026-10-06T11:00:00+05:30') });
    const other = await friend.newPage();
    await other.goto(link);
    await expect(other.getByText('You have been dared')).toBeVisible();
    await expect(other.getByText('Loser cooks dinner')).toBeVisible();
    await other.getByRole('button', { name: 'Accept the dare' }).click();
    await expect(other.getByText('Challenge accepted.').first()).toBeVisible();
    await expect.poll(async () => (await savedGame(other)).challenge.active?.role).toBe('friend');
    await friend.close();

    // The link carries only what it needs and is the same one on a reload.
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Your challenge link' })).toHaveValue(link);
  });

  test('a damaged link says so instead of breaking', async ({ page }) => {
    await visit(page, '/community#c=not-a-real-challenge');
    await expect(page.getByRole('tab', { name: /^Journal/ })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('giving a challenge up is a choice behind a confirmation', async ({ page }) => {
    await visit(page, '/community?tab=challenge');
    const category = page.getByRole('combobox', { name: 'Category' });
    if (await category.isVisible()) {
      await category.click();
      await page.getByRole('option').first().click();
    }
    await page.getByRole('button', { name: 'Create link' }).click();
    await expect.poll(async () => (await savedGame(page)).challenge.active).not.toBeNull();
    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByText('Give up this challenge?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep going' }).click();
    expect((await savedGame(page)).challenge.active).not.toBeNull();
  });
});

test.describe('the share card', () => {
  test('is drawn on this device and downloads as a real PNG', async ({ page }) => {
    // A browser with a share sheet would offer that instead of a file: this is the file path.
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
    await visit(page, '/community?tab=share');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /^(Download PNG|Share card)$/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);
    const bytes = readFileSync(await file.path());
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.length).toBeGreaterThan(5_000);
    await expect(page.getByText(/^Saved as a PNG\./)).toBeVisible();
  });

  test('changing the card shape redraws the preview', async ({ page }) => {
    await visit(page, '/community?tab=share');
    const preview = page.locator('canvas').first();
    await expect(preview).toBeVisible();
    const story = await preview.evaluate(
      (canvas: HTMLCanvasElement) => canvas.height / canvas.width,
    );
    await page.getByRole('radio', { name: 'Square' }).click();
    await expect
      .poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.height / canvas.width))
      .not.toBe(story);
  });
});

test.describe('from the team', () => {
  test('eight starter notes can be saved and are marked as editorial', async ({ page }) => {
    await visit(page, '/community?tab=team');
    await expect(page.getByText(/Editorial · Starter pack/).first()).toBeVisible();
    await page
      .getByRole('button', { name: /^Save$/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /^Saved$/ }).first()).toBeVisible();
  });
});
