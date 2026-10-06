import { expect, ready, test, visit } from './support/test';
import { expectNothingPlanted, plantTree, savedGame, walkOnboarding } from './support/app';
import { GAME_KEY, seeded } from './support/seeds';

test.use({ storageState: seeded('fresh') });

test.describe('the landing page', () => {
  test('opens on the idea and one way in', async ({ page }) => {
    await visit(page, '/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /Grow a living tree by shrinking your footprint/,
    );
    await expect(page.getByRole('link', { name: 'Plant your tree' }).first()).toHaveAttribute(
      'href',
      '/start',
    );
    await expect(page.getByRole('link', { name: 'Methodology' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' }).first()).toBeVisible();
  });

  test('draws the tree at once and keeps every second call to action honest', async ({ page }) => {
    await visit(page, '/');
    // The illustrated tree is the first paint, whatever the browser can do.
    await expect(page.locator('[data-world-stage]').first()).toBeVisible();
    await expect(page.locator('[data-world-fallback]').first()).toBeVisible();
    // Nothing was saved just by looking.
    expect(await page.evaluate((key) => localStorage.getItem(key), GAME_KEY)).toBeNull();
  });

  test('the try-it demo grows a tree and saves nothing', async ({ page }) => {
    await visit(page, '/');
    const readout = page.getByRole('group', { name: 'What the demo printed' });
    await readout.scrollIntoViewIfNeeded();
    await expect(readout.getByRole('status')).toContainText('Tap a sticker');

    await page.getByRole('button', { name: 'Plant-based lunch' }).click();
    await expect(readout.getByRole('status')).toContainText('Demo tree:');
    await expect(readout.getByText('Plant-based lunch').first()).toBeVisible();
    await expect(readout).toContainText('approximately');

    await page.getByRole('button', { name: 'Biked 5 km' }).click();
    await page.getByRole('button', { name: 'Shorter shower' }).click();
    await expect(readout.getByRole('link', { name: 'Plant it' })).toBeVisible();

    expect(await page.evaluate((key) => localStorage.getItem(key), GAME_KEY)).toBeNull();
    await readout.getByRole('link', { name: 'Plant it' }).click();
    await expect(page).toHaveURL(/\/start$/);
  });

  test('the try-it demo lets a visitor pick a species', async ({ page }) => {
    await visit(page, '/');
    const species = page
      .getByRole('radio', { name: /Cherry/ })
      .or(page.getByRole('button', { name: 'Cherry' }));
    await species.first().click();
    await expect(page.getByRole('button', { name: 'Plant-based lunch' })).toBeEnabled();
  });

  test('"See day 200" opens a sandbox that never touches a real save', async ({ page }) => {
    await visit(page, '/');
    await page.getByRole('link', { name: 'See day 200' }).click();
    await expect(page).toHaveURL(/\/demo/);
    const banner = page.getByRole('complementary', { name: 'Demo world' });
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText('Nothing is saved');
    // The stand-in save lives in session storage under its own prefix.
    expect(await page.evaluate((key) => localStorage.getItem(key), GAME_KEY)).toBeNull();
    await banner.getByRole('link', { name: 'Exit the demo world' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate((key) => localStorage.getItem(key), GAME_KEY)).toBeNull();
  });
});

test.describe('onboarding', () => {
  test('with the quiz: a result, a focus, a planted tree and a first day', async ({ page }) => {
    await visit(page, '/start');
    await walkOnboarding(page, {
      name: 'Riley',
      species: 'Cherry blossom',
      treeName: 'Blossom',
      quiz: true,
    });

    // The ceremony is the last screen; nothing is planted until it is confirmed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Press and hold to plant Blossom.',
    );
    await expectNothingPlanted(page);

    await page.getByRole('button', { name: 'Plant', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blossom is planted.');
    await expect(page.getByText('Ring 1 is yours.', { exact: true })).toBeVisible();

    const saved = await savedGame(page);
    expect(saved.profile.name).toBe('Riley');
    expect(saved.profile.treeName).toBe('Blossom');
    expect(saved.profile.species).toBe('cherry');
    expect(saved.onboarding.completedAt).not.toBeNull();
    expect(saved.tree.rings).toBe(1);
    expect(saved.xp).toBeGreaterThan(0);
    expect(saved.baseline.current).not.toBeNull();
    expect(saved.profile.focus.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Give Blossom its first leaf' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Riley');
    await expect(page.getByRole('group', { name: /Blossom, a 1-ring cherry/ })).toBeVisible();
  });

  test('without the quiz: the same tree, no starting line', async ({ page }) => {
    await visit(page, '/start');
    await plantTree(page, { quiz: false, treeName: 'Sprig' });
    await ready(page);

    const saved = await savedGame(page);
    expect(saved.profile.treeName).toBe('Sprig');
    expect(saved.profile.species).toBe('oak');
    expect(saved.baseline.current).toBeNull();
    expect(saved.onboarding.completedAt).not.toBeNull();
    expect(saved.tree.rings).toBe(1);
    // Skipping the quiz is never a penalty: Today works and offers the log.
    await expect(page.getByRole('link', { name: 'Log an action' }).first()).toBeVisible();
  });

  test('the first screen promises privacy, honesty and kindness', async ({ page }) => {
    await visit(page, '/start');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Let's plant.");
    await expect(page.getByText('Everything stays on this device. No account.')).toBeVisible();
    await expect(page.getByText('Estimates come with their sources.')).toBeVisible();
    await expect(page.getByText('Your tree never dies.')).toBeVisible();
  });

  test('Back keeps what was typed and a reload resumes where the visitor was', async ({ page }) => {
    await visit(page, '/start');
    await page.getByRole('button', { name: "Let's plant" }).click();
    await page.getByRole('textbox', { name: 'Your name' }).fill('Sam');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick a tree');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Sam');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.reload();
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick a tree');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Sam');
  });

  test('the tree needs a name before the visitor can go on', async ({ page }) => {
    await visit(page, '/start');
    await page.getByRole('button', { name: "Let's plant" }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    const name = page.getByRole('textbox', { name: /^Name it/ });
    await name.fill('');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick a tree');
    await page.getByRole('button', { name: 'Suggest a name' }).click();
    await expect(name).not.toHaveValue('');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Know where you start?');
  });

  test('leaving the quiz early keeps the answers and carries on', async ({ page }) => {
    await visit(page, '/start');
    await page.getByRole('button', { name: "Let's plant" }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /^Take the 60-second quiz/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByRole('group', { name: /how you eat/ })
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: 'Finish later' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick up to three.');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Know where you start?');
    await expect(page.getByRole('button', { name: /^Carry on with the quiz/ })).toBeVisible();
  });
});

test.describe('the planting ceremony', () => {
  test('a long press plants once, stamps the date and ends on Today', async ({ page }) => {
    await visit(page, '/start');
    await walkOnboarding(page, { quiz: false, treeName: 'Pip' });

    const hold = page.getByRole('button', { name: /^Press and hold to plant Pip/ });
    await expect(hold).toBeVisible();
    // Space held for the full length of the hold; the clock is the test's, not the wall's.
    await hold.focus();
    await page.keyboard.down('Space');
    await page.clock.runFor(2000);
    await page.keyboard.up('Space');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pip is planted.');
    await expect(page.getByText('Planted', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Ring 1 is yours.', { exact: true })).toBeVisible();
    const saved = await savedGame(page);
    expect(saved.tree.rings).toBe(1);
    const xpAfterPlanting = saved.xp;

    const next = page.getByRole('button', { name: 'Give Pip its first leaf' });
    await expect(next).toBeFocused();
    await next.click();
    await expect(page).toHaveURL(/\/today$/);
    expect((await savedGame(page)).xp).toBe(xpAfterPlanting);
  });

  test('letting go early plants nothing', async ({ page }) => {
    await visit(page, '/start');
    await walkOnboarding(page, { quiz: false, treeName: 'Pip' });
    const hold = page.getByRole('button', { name: /^Press and hold to plant Pip/ });
    await hold.focus();
    await page.keyboard.down('Space');
    await page.clock.runFor(500);
    await page.keyboard.up('Space');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Press and hold to plant Pip.',
    );
    await expectNothingPlanted(page);
  });

  test('once planted, /start leads straight to Today and the landing page too', async ({
    page,
  }) => {
    await visit(page, '/start');
    await plantTree(page, { quiz: false });
    await page.goto('/start');
    await expect(page).toHaveURL(/\/today$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/today$/);
  });

  test('a seed, once planted, shows on Today with a ring and an honest empty day', async ({
    page,
  }) => {
    await visit(page, '/start');
    await plantTree(page, { quiz: false, name: 'Alex', treeName: 'Fern' });
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Alex');
    await expect(page.getByRole('progressbar', { name: "Today's ring" })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Stick one on' })).toBeVisible();
    await expect(page.getByRole('region', { name: "Today's quests" })).toBeVisible();
  });
});
