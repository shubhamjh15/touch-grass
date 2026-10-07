import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, ready, test, visit } from './support/test';
import { savedGame } from './support/app';
import { GAME_KEY, seeded } from './support/seeds';

/**
 * Me: the settings that stick, the data that is the person's own (export, reset behind a
 * typed confirmation, import that restores), all read from the page and from the save.
 */

test.use({ storageState: seeded('day12') });

async function openTab(page: Page, tab: 'badges' | 'island' | 'settings' | 'data'): Promise<void> {
  await visit(page, `/me?tab=${tab}`);
}

async function choose3d(page: Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: '3D quality' }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test.describe('settings', () => {
  test('3D quality, motion, sky and sound persist across a reload', async ({ page }) => {
    await openTab(page, 'settings');
    await choose3d(page, 'Low');
    await page.getByRole('radio', { name: 'Reduced' }).click();
    await page.getByRole('radio', { name: 'Always day' }).click();
    await page.getByRole('switch', { name: /^Sound/ }).click();

    await expect
      .poll(async () => (await savedGame(page)).settings)
      .toMatchObject({ graphics: 'low', motion: 'reduced', sky: 'day', sound: false });

    await page.reload();
    await ready(page);
    await expect(page.getByRole('combobox', { name: '3D quality' })).toContainText('Low');
    await expect(page.getByRole('radio', { name: 'Reduced' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Always day' })).toBeChecked();
    await expect(page.getByRole('switch', { name: /^Sound/ })).not.toBeChecked();
  });

  test('"Still illustration" is saved as graphics off', async ({ page }) => {
    await openTab(page, 'settings');
    await choose3d(page, 'Still illustration');
    await expect.poll(async () => (await savedGame(page)).settings.graphics).toBe('off');
  });

  test('the settings tab is addressable and keeps the tab on reload', async ({ page }) => {
    await openTab(page, 'settings');
    await expect(page.getByRole('tab', { name: /^Settings/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: /^Data/ }).click();
    await expect(page.getByRole('heading', { name: 'Take it with you' })).toBeVisible();
  });
});

test.describe('export', () => {
  test('JSON holds the whole save under the app id, with a dated file name', async ({ page }) => {
    await openTab(page, 'data');
    const saved = await savedGame(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^touch-grass-\d{4}-\d{2}-\d{2}\.json$/);
    // Checked at once: the note fades after a few seconds, sooner than a busy machine reads a file.
    await expect(page.getByText(/^Saved touch-grass-.*\.json\.$/).first()).toBeVisible();

    const path = await file.path();
    const envelope = JSON.parse(readFileSync(path, 'utf8')) as {
      app: string;
      state: { logs: unknown[]; profile: { treeName: string } };
    };
    expect(envelope.app).toBe('touchgrass');
    expect(envelope.state.logs).toHaveLength(saved.logs.length);
    expect(envelope.state.profile.treeName).toBe(saved.profile.treeName);
  });

  test('CSV has a header and one row per log', async ({ page }) => {
    await openTab(page, 'data');
    const saved = await savedGame(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    const lines = readFileSync(await file.path(), 'utf8')
      .trim()
      .split(/\r?\n/);
    expect(lines).toHaveLength(saved.logs.length + 1);
  });
});

test.describe('reset', () => {
  test('stays locked until the tree is named, can be cancelled, and then wipes everything', async ({
    page,
  }) => {
    await openTab(page, 'data');
    const { treeName } = (await savedGame(page)).profile;
    await page.getByRole('button', { name: 'Reset Touch Grass' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset Touch Grass?' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Reset everything' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('not the name');
    await expect(confirm).toBeDisabled();

    await dialog.getByRole('button', { name: 'Keep my data' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await savedGame(page)).profile.treeName).toBe(treeName);

    await page.getByRole('button', { name: 'Reset Touch Grass' }).click();
    await dialog.getByRole('textbox').fill(treeName);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key);
          if (raw === null) return 'empty';
          const parsed = JSON.parse(raw) as { state: { logs: unknown[]; xp: number } };
          return parsed.state.logs.length === 0 && parsed.state.xp === 0 ? 'empty' : 'kept';
        }, GAME_KEY),
      )
      .toBe('empty');

    // Nothing is planted any more: the app asks for a tree again.
    await page.goto('/today');
    await expect(page).toHaveURL(/\/start$/);
  });
});

test.describe('import', () => {
  test('restores an earlier export over what has changed since, after a typed confirmation', async ({
    page,
  }) => {
    await openTab(page, 'data');
    const original = await savedGame(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const exported = await (await download).path();

    // Change things, then bring the old save back.
    await page.goto('/log');
    await page.getByRole('button', { name: /^Short shower/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Stick (it|\d+) on$/ })
      .click();
    await expect
      .poll(async () => (await savedGame(page)).logs.length)
      .toBe(original.logs.length + 1);

    await openTab(page, 'data');
    await page.getByLabel('Choose an export file to import').setInputFiles(exported);
    const dialog = page.getByRole('dialog', { name: /Replace this device/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(original.profile.treeName);
    const replace = dialog.getByRole('button', { name: 'Replace data' });
    await expect(replace).toBeDisabled();
    await dialog.getByRole('textbox').fill('replace');
    await replace.click();

    await expect(
      page.getByText(`${original.profile.treeName} is back. Data replaced.`),
    ).toBeVisible();
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(original.logs.length);
    const restored = await savedGame(page);
    expect(restored.xp).toBe(original.xp);
    expect(restored.tree.gp).toBe(original.tree.gp);
    expect(restored.profile.treeName).toBe(original.profile.treeName);
  });

  test('a file that is not an export is refused and nothing changes', async ({ page }) => {
    await openTab(page, 'data');
    const before = await savedGame(page);
    await page.getByLabel('Choose an export file to import').setInputFiles({
      name: 'notes.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    });
    const alert = page.getByRole('alert').filter({ hasText: "That file wasn't imported" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Nothing was changed.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await savedGame(page)).toEqual(before);
  });

  test('a file that is not even JSON is refused kindly', async ({ page }) => {
    await openTab(page, 'data');
    await page.getByLabel('Choose an export file to import').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json {'),
    });
    await expect(
      page.getByRole('alert').filter({ hasText: "That file wasn't imported" }),
    ).toBeVisible();
  });
});
