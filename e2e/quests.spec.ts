import type { Page } from '@playwright/test';
import { expect, test, visit } from './support/test';
import { savedGame } from './support/app';
import { seeded } from './support/seeds';

test.use({ storageState: seeded('day12') });

const board = (page: Page) => page.getByRole('region', { name: "Today's three" });

test.describe('daily quests', () => {
  test('show what is ready, what is in progress and what the next step is', async ({ page }) => {
    await visit(page, '/quests');
    await expect(page.getByRole('tab', { name: /^Daily/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(board(page).getByRole('heading', { level: 4 })).toHaveCount(3);
    await expect(
      board(page).getByRole('button', { name: 'Claim +15 XP for First light' }),
    ).toBeVisible();
    // A quest that is not done yet says what counts toward it and links to the log, prefilled.
    const walk = board(page).getByRole('link', { name: /^Log: Walked or cycled/ });
    await expect(walk).toHaveAttribute('href', /\/log\?a=walk-cycle-instead-of-car&q=5&src=quest/);
  });

  test('progress comes from logging, and a finished quest can be claimed once', async ({
    page,
  }) => {
    await visit(page, '/quests');
    const meter = board(page).getByRole('meter', { name: 'Five by muscle progress' });
    const progressBefore = Number(await meter.getAttribute('aria-valuenow'));
    expect(progressBefore).toBeLessThan(Number(await meter.getAttribute('aria-valuemax')));
    const before = await savedGame(page);

    // The quest's own link opens the log with the amount filled in; nothing is logged by itself.
    await board(page)
      .getByRole('link', { name: /^Log: Walked or cycled/ })
      .click();
    await expect(page).toHaveURL(/\/log\?/);
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    expect((await savedGame(page)).logs).toHaveLength(before.logs.length);
    await sheet.getByRole('button', { name: 'Stick it on' }).click();
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);

    await page.goto('/quests');
    const done = board(page).getByRole('button', { name: 'Claim +25 XP for Five by muscle' });
    await expect(done).toBeVisible();
    const full = board(page).getByRole('meter', { name: 'Five by muscle progress' });
    await expect(full).toHaveAttribute(
      'aria-valuenow',
      (await full.getAttribute('aria-valuemax')) ?? '',
    );

    const xpBefore = (await savedGame(page)).xp;
    await done.click();
    await expect(page.getByText('Claimed. Plus 25 XP.').first()).toBeVisible();
    const claimed = await savedGame(page);
    expect(claimed.xp).toBe(xpBefore + 25);
    const claims = claimed.quests.claims.filter((claim) => claim.questId === 'd_five_k');
    expect(claims).toHaveLength(1);

    // Once only: the button is gone, and so is a second payment, even after a reload.
    await expect(board(page).getByRole('button', { name: /Claim .* Five by muscle/ })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(board(page).getByText('Five by muscle (claimed)')).toBeVisible();
    const reloaded = await savedGame(page);
    expect(reloaded.xp).toBe(claimed.xp);
    expect(reloaded.quests.claims.filter((claim) => claim.questId === 'd_five_k')).toHaveLength(1);
  });

  test('claiming is idempotent: a reload changes nothing and a double click pays once', async ({
    page,
  }) => {
    await visit(page, '/quests');
    const before = await savedGame(page);
    const claim = board(page).getByRole('button', { name: 'Claim +15 XP for First light' });
    await claim.dblclick();
    await expect(board(page).getByText('First light (claimed)')).toBeVisible();
    const once = await savedGame(page);
    expect(once.xp).toBe(before.xp + 15);
    expect(
      once.quests.claims.filter(
        (entry) => entry.questId === 'd_first_light' && entry.period === '2026-10-06',
      ),
    ).toHaveLength(1);

    await page.reload();
    await page.reload();
    const reloaded = await savedGame(page);
    expect(reloaded.xp).toBe(once.xp);
    expect(reloaded.quests.claims).toHaveLength(once.quests.claims.length);
    await expect(board(page).getByText('First light (claimed)')).toBeVisible();
  });

  test('the stage reacts to a claim and the HUD keeps its numbers in step', async ({ page }) => {
    await visit(page, '/quests');
    const before = await savedGame(page);
    await board(page).getByRole('button', { name: 'Claim +15 XP for First light' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Claimed' })).toBeVisible();
    expect((await savedGame(page)).xp).toBe(before.xp + 15);
  });

  test('one swap a day, on a quest that has not been started', async ({ page }) => {
    await visit(page, '/quests');
    const before = await savedGame(page);
    const swap = board(page)
      .getByRole('button', { name: /^Swap this quest/ })
      .first();
    const titleBefore = await board(page).getByRole('heading', { level: 4 }).allTextContents();
    await swap.click();
    await expect.poll(async () => (await savedGame(page)).quests.daily?.swapsUsed).toBe(1);
    const titleAfter = await board(page).getByRole('heading', { level: 4 }).allTextContents();
    expect(titleAfter).not.toEqual(titleBefore);
    expect((await savedGame(page)).xp).toBe(before.xp);
    // No second swap today.
    await expect(board(page).getByRole('button', { name: /^Swap this quest/ })).toHaveCount(0);
  });
});

test.describe('weekly quests and epics', () => {
  test('the weekly and epic boards open and list their quests', async ({ page }) => {
    await visit(page, '/quests');
    await page.getByRole('tab', { name: /^Weekly/ }).click();
    await expect(page.getByRole('tabpanel', { name: /^Weekly/ })).toBeVisible();
    await expect(
      page.getByRole('tabpanel').getByRole('heading', { level: 4 }).first(),
    ).toBeVisible();
    await page.getByRole('tab', { name: /^Epics/ }).click();
    await expect(page.getByRole('tabpanel', { name: /^Epics/ })).toBeVisible();
    await expect(
      page.getByRole('tabpanel').getByRole('heading', { level: 3 }).first(),
    ).toBeVisible();
  });

  test('a new day brings a fresh board, and yesterday’s claim stays paid once', async ({
    page,
  }) => {
    await visit(page, '/quests');
    await board(page).getByRole('button', { name: 'Claim +15 XP for First light' }).click();
    await expect(board(page).getByText('First light (claimed)')).toBeVisible();
    const paid = await savedGame(page);

    // Past midnight: the app settles the calendar on its next minute tick.
    await page.clock.fastForward('14:00:00');
    await expect.poll(async () => (await savedGame(page)).quests.daily?.key).toBe('2026-10-07');
    const nextDay = await savedGame(page);
    expect(nextDay.quests.claims.filter((entry) => entry.period === '2026-10-06')).toHaveLength(
      paid.quests.claims.filter((entry) => entry.period === '2026-10-06').length,
    );
    await expect(board(page).getByRole('heading', { level: 4 })).toHaveCount(3);
  });
});
