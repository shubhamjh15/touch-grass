import type { Page } from '@playwright/test';
import { expect, ready, test, visit } from './support/test';
import { plantTree, readHud, savedGame } from './support/app';
import { COACH_KEY, GAME_KEY, fixtureEntries, seeded, storageOf } from './support/seeds';

/**
 * What a person trusts the app with: what they did is still there after a reload, a damaged
 * save never crashes the app or vanishes silently, the old app's data is offered rather than
 * dropped, and two tabs of the same browser agree.
 */

const RECOVERY_KEY = 'touchgrass:game:recovery';
const LEGACY_BACKUP_KEY = 'touchgrass:legacy-backup';

async function stickShower(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Short shower/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Stick (it|\d+) on$/ })
    .click();
}

test.describe('a reload', () => {
  test.use({ storageState: seeded('day12') });

  test('keeps the tree, the numbers and the day exactly as they were', async ({ page }) => {
    await visit(page, '/log');
    // The saved state already holds logs: wait for this one, or the snapshot is taken too early.
    const logged = (await savedGame(page)).logs.length;
    await stickShower(page);
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(logged + 1);
    const before = await savedGame(page);
    const hud = await readHud(page);

    await page.reload();
    await ready(page);
    expect(await savedGame(page)).toEqual(before);
    expect(await readHud(page)).toEqual(hud);
    await expect(
      page.getByRole('list', { name: 'Actions logged today' }).getByText('Short shower'),
    ).toBeVisible();
  });

  test('an open page keeps working with the network gone', async ({ page, context, health }) => {
    // The browser fails the requests it makes while the network is down; that is the point.
    health.allow(/ERR_INTERNET_DISCONNECTED/);
    await visit(page, '/log');
    await context.setOffline(true);
    const before = await savedGame(page);
    await stickShower(page);
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);
    await context.setOffline(false);
  });
});

test.describe('a save that cannot be read', () => {
  const unreadable: Array<[string, string]> = [
    ['text that is not JSON', 'this is {not json'],
    ['JSON that is not a save', '{"hello":"world"}'],
    ['a save from a newer version', '{"version":99,"state":{}}'],
    ['a save with the wrong shape', '{"version":1,"state":{"xp":"lots","logs":7}}'],
  ];

  for (const [what, raw] of unreadable) {
    test.describe(what, () => {
      test.use({ storageState: storageOf({ [GAME_KEY]: raw }) });

      test('opens the app without a crash, keeps the raw text aside and starts fresh', async ({
        page,
      }) => {
        await page.goto('/today');
        await expect(page).toHaveURL(/\/start$/);
        await ready(page);
        await expect(page.locator('h1')).toHaveCount(1);
        // Never a silent wipe: the unreadable text is still on the device.
        const kept = await page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY);
        expect(kept).not.toBeNull();
        const entries = JSON.parse(kept ?? '[]') as Array<{ raw: string; reason: string }>;
        expect(entries.map((entry) => entry.raw)).toContain(raw);
        expect(entries.at(-1)?.reason).toBeTruthy();
      });
    });
  }

  test.describe('after the app has started fresh', () => {
    test.use({ storageState: storageOf({ [GAME_KEY]: 'this is {not json' }) });

    test('planting works and the set-aside copy survives it', async ({ page }) => {
      await visit(page, '/start');
      await plantTree(page, { quiz: false, treeName: 'Again' });
      await ready(page);
      expect((await savedGame(page)).profile.treeName).toBe('Again');
      const kept = await page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY);
      expect(kept).toContain('this is {not json');
    });
  });

  test.describe('a damaged coach chat', () => {
    test.use({
      storageState: storageOf({ ...fixtureEntries('day12'), [COACH_KEY]: '{{{ not json' }),
    });

    test('does not stop the coach from opening', async ({ page }) => {
      await visit(page, '/coach');
      await expect(page.getByRole('textbox', { name: 'Message Moss' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'Moss' })).toBeVisible();
    });
  });
});

test.describe('a save written before some fields existed', () => {
  test.use({
    storageState: (() => {
      const entries = fixtureEntries('day12');
      const file = JSON.parse(entries[GAME_KEY] ?? '{}') as Record<string, unknown> & {
        state: Record<string, unknown> & {
          logs: Array<Record<string, unknown>>;
          seen: Record<string, unknown>;
        };
      };
      // Fields the app added later: the loader fills them in rather than calling the save damaged.
      delete file.state.reactions;
      delete file.state.notices;
      delete file.state.seen.shareExports;
      for (const log of file.state.logs) delete log.effort;
      entries[GAME_KEY] = JSON.stringify(file);
      return storageOf(entries);
    })(),
  });

  test('loads as it was and keeps everything it had', async ({ page }) => {
    await visit(page, '/today');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: "Today's ring" })).toBeVisible();
    const saved = await savedGame(page);
    expect(saved.logs.length).toBeGreaterThan(10);
    expect(saved.profile.treeName).toBe('Fern');
  });
});

test.describe('the earlier version of the app', () => {
  const day = (iso: string): number => new Date(iso).getTime();
  const oldLogs = JSON.stringify([
    { id: String(day('2026-10-03T09:00:00+05:30')), type: 'Veggie Meal' },
    { id: String(day('2026-10-04T18:30:00+05:30')), type: 'Recycled' },
    { id: String(day('2026-10-05T08:15:00+05:30')), type: 'Planted a hedge' },
    { id: '1', type: 'Sample row' },
  ]);

  test.describe('with real logs', () => {
    test.use({
      storageState: storageOf({
        userStats: JSON.stringify({ xp: 4250, kg: 45.2, streak: 12 }),
        actionLogs: oldLogs,
      }),
    });

    test('offers them, brings them without a made-up CO2e figure, and keeps a backup', async ({
      page,
    }) => {
      await visit(page, '/start');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Bring your old logs along?',
      );
      await expect(page.getByText(/We found 3 actions/)).toBeVisible();
      await page.getByRole('button', { name: 'Bring them' }).click();
      await plantTree(page, { quiz: false, treeName: 'Heir' });
      await ready(page);

      const saved = await savedGame(page);
      const brought = saved.logs.filter((log) => log.source === 'legacy');
      expect(brought).toHaveLength(3);
      expect(brought.map((log) => log.co2eKg)).toEqual([null, null, null]);
      expect(brought.map((log) => log.title)).toContain('Planted a hedge');
      // The old app's invented totals are never carried over.
      expect(saved.xp).toBeLessThan(1000);

      const keys = await page.evaluate(
        ([backup]) => ({
          stats: localStorage.getItem('userStats'),
          logs: localStorage.getItem('actionLogs'),
          backup: localStorage.getItem(backup ?? ''),
        }),
        [LEGACY_BACKUP_KEY],
      );
      expect(keys.stats).toBeNull();
      expect(keys.logs).toBeNull();
      expect(keys.backup).toContain('Veggie Meal');
    });

    test('"Start fresh" leaves the old logs out but still keeps a backup', async ({ page }) => {
      await visit(page, '/start');
      await page.getByRole('button', { name: 'Start fresh' }).click();
      await plantTree(page, { quiz: false, treeName: 'Fresh' });
      await ready(page);
      const saved = await savedGame(page);
      expect(saved.logs.filter((log) => log.source === 'legacy')).toHaveLength(0);
      const backup = await page.evaluate(
        ([key]) => localStorage.getItem(key ?? ''),
        [LEGACY_BACKUP_KEY],
      );
      expect(backup).toContain('Veggie Meal');
    });
  });

  test.describe('with only the old sample data', () => {
    test.use({
      storageState: storageOf({
        userStats: JSON.stringify({ xp: 4250, kg: 45.2, streak: 12 }),
        actionLogs: JSON.stringify([{ id: '1', type: 'Sample row' }]),
      }),
    });

    test('invented numbers are never imported and there is nothing to offer', async ({ page }) => {
      await visit(page, '/start');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText("Let's plant.");
      await plantTree(page, { quiz: false, treeName: 'Clean' });
      const saved = await savedGame(page);
      expect(saved.xp).toBeLessThan(200);
      expect(saved.logs).toHaveLength(0);
    });
  });
});

test.describe('two tabs of one browser', () => {
  test.use({ storageState: seeded('day12') });

  // Only the tab in front paints and runs its animations, as in a real browser: each step
  // says which tab the person is looking at.
  const ledger = (tab: Page) => tab.getByRole('list', { name: 'Actions logged today' });

  test('stay in step in both directions, without a reload', async ({ context, page }) => {
    await visit(page, '/log');
    const other = await context.newPage();
    await visit(other, '/log');

    await page.bringToFront();
    await stickShower(page);
    await expect(ledger(page).getByText('Short shower')).toBeVisible();
    await other.bringToFront();
    await expect(ledger(other).getByText('Short shower')).toBeVisible();

    await other.getByRole('button', { name: /^Standby off/ }).click();
    await other
      .getByRole('dialog')
      .getByRole('button', { name: /^Stick (it|\d+) on$/ })
      .click();
    await expect(ledger(other).getByText(/Standby off/)).toBeVisible();
    await page.bringToFront();
    await expect(ledger(page).getByText(/Standby off/)).toBeVisible();

    const a = await savedGame(page);
    const b = await savedGame(other);
    expect(a.logs.map((log) => log.id)).toEqual(b.logs.map((log) => log.id));
    expect(a.xp).toBe(b.xp);
    expect((await readHud(page)).streak).toBe((await readHud(other)).streak);
  });

  test('a reset in one tab does not leave the other showing a tree that is gone', async ({
    context,
    page,
  }) => {
    await visit(page, '/me?tab=data');
    const other = await context.newPage();
    await visit(other, '/today');
    await page.bringToFront();
    const { treeName } = (await savedGame(page)).profile;

    await page.getByRole('button', { name: 'Reset Touch Grass' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset Touch Grass?' });
    await dialog.getByRole('textbox').fill(treeName);
    await dialog.getByRole('button', { name: 'Reset everything' }).click();
    await expect(page).toHaveURL(/\/$/);

    await other.bringToFront();
    await expect(other).toHaveURL(/\/(start)?$/, { timeout: 20_000 });
  });
});
