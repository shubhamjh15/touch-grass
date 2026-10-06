import type { Page } from '@playwright/test';
import { expect, test, visit } from './support/test';
import { savedGame } from './support/app';
import { COACH_KEY, seeded } from './support/seeds';

/**
 * The coach with no AI key on the server: every answer comes from the built-in coach, and
 * the page says so. The same conversation is also the drawer, opened from anywhere.
 */

test.use({ storageState: seeded('day12') });

const conversation = (page: Page) => page.getByRole('list', { name: 'Conversation with Moss' });
const composer = (page: Page) => page.getByRole('textbox', { name: 'Message Moss' });

async function ask(page: Page, text: string): Promise<void> {
  await composer(page).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

test.describe('the built-in coach', () => {
  test('greets by name, says which coach is in, and answers a typed question', async ({ page }) => {
    await visit(page, '/coach');
    await expect(page.getByRole('heading', { level: 1, name: 'Moss' })).toBeVisible();
    await expect(page.getByText('Built-in', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Built-in coach: notes kept on this device, not AI/)).toBeVisible();
    await expect(conversation(page)).toContainText(/\w/);

    await ask(page, 'Is recycling actually worth it?');
    await expect(conversation(page).getByText('Is recycling actually worth it?')).toBeVisible();
    const answer = conversation(page).getByRole('article').last();
    await expect(answer).toContainText('Built-in answer');
    await expect(answer).toContainText(/recycl/i, { timeout: 30_000 });
    // The box is free again and the draft is gone.
    await expect(composer(page)).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), COACH_KEY))
      .toContain('recycling');
  });

  test('an empty message is refused with a nudge, not sent', async ({ page }) => {
    await visit(page, '/coach');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Type a message first.')).toBeVisible();
  });

  test('an idea chip asks the question for you', async ({ page }) => {
    await visit(page, '/coach');
    await page.getByRole('button', { name: 'One easy win for today' }).click();
    await expect(conversation(page).getByText('One easy win for today').first()).toBeVisible();
    await expect(conversation(page).getByRole('article').last()).toContainText('Built-in answer');
  });

  test('Moss is on every page: the drawer opens, answers and closes with Escape', async ({
    page,
  }) => {
    await visit(page, '/quests');
    await page
      .getByRole('button', { name: /^Ask Moss/ })
      .filter({ visible: true })
      .first()
      .click();
    const drawer = page.getByRole('dialog', { name: /Moss/ });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('textbox', { name: 'Message Moss' }).fill('Explain my numbers');
    await drawer.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(drawer.getByRole('article').last()).toContainText('Built-in answer', {
      timeout: 30_000,
    });
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });
});

test.describe('suggestions that log', () => {
  test('a log chip opens a confirmation and sticks the action on only when asked', async ({
    page,
  }) => {
    await visit(page, '/coach');
    const before = await savedGame(page);
    await page.getByRole('button', { name: 'One easy win for today' }).click();
    const chips = page.getByRole('list', { name: 'Suggestions from Moss' });
    await expect(chips).toBeVisible({ timeout: 30_000 });
    const logChip = chips.getByRole('button', { name: /^Log\b|Log:/ }).first();
    await logChip.click();

    const confirm = page.getByRole('group', { name: /^Log: / }).or(page.getByText('How much?'));
    await expect(confirm.first()).toBeVisible();
    // Nothing is logged by opening it.
    expect((await savedGame(page)).logs).toHaveLength(before.logs.length);

    await page.getByRole('button', { name: 'Stick it on' }).click();
    await expect.poll(async () => (await savedGame(page)).logs.length).toBe(before.logs.length + 1);
    expect((await savedGame(page)).logs.at(-1)?.source).toBe('coach');
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /Stuck|First act/ }),
    ).toBeVisible();
  });

  test('"Not now" closes the confirmation and logs nothing', async ({ page }) => {
    await visit(page, '/coach');
    const before = await savedGame(page);
    await page.getByRole('button', { name: 'One easy win for today' }).click();
    const chips = page.getByRole('list', { name: 'Suggestions from Moss' });
    await expect(chips).toBeVisible({ timeout: 30_000 });
    await chips
      .getByRole('button', { name: /^Log\b|Log:/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('button', { name: 'Stick it on' })).toHaveCount(0);
    expect((await savedGame(page)).logs).toHaveLength(before.logs.length);
  });
});

test.describe('stop, retry and clear', () => {
  test('Stop ends an answer part-way, says so, and "Ask again" gives the whole answer', async ({
    page,
  }) => {
    await visit(page, '/coach');
    await ask(page, 'Plan me a low-carbon dinner');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByText('Stopped here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Ask again' }).click();
    await expect(page.getByText('Stopped here.')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(conversation(page).getByRole('article').last()).toContainText(
      /dinner|meal|bean|lentil/i,
    );
  });

  test('with the network gone the page says so and the built-in coach still answers', async ({
    page,
    context,
    health,
  }) => {
    health.allow(/ERR_INTERNET_DISCONNECTED/);
    await visit(page, '/coach');
    await context.setOffline(true);
    await expect(
      page.getByText(/You're offline, so the built-in coach is answering/).first(),
    ).toBeVisible();
    await ask(page, 'One easy win for today');
    await expect(conversation(page).getByRole('article').last()).toContainText('Built-in answer', {
      timeout: 30_000,
    });
    await context.setOffline(false);
    await expect(page.getByText(/You're offline/)).toHaveCount(0);
  });

  test('Clear chat asks first, then leaves a fresh page and an empty saved chat', async ({
    page,
  }) => {
    await visit(page, '/coach');
    await ask(page, 'Explain my numbers');
    await expect(conversation(page).getByRole('article').last()).toContainText('Built-in answer', {
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByRole('menuitem', { name: 'Clear chat' }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('Clear this chat?');
    // Keep it first.
    await dialog.getByRole('button', { name: /^Cancel|Keep/ }).click();
    await expect(conversation(page).getByText('Explain my numbers')).toBeVisible();

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByRole('menuitem', { name: 'Clear chat' }).click();
    await dialog.getByRole('button', { name: 'Clear chat' }).click();
    await expect(page.getByText('Chat cleared. A fresh page.')).toBeVisible();
    await expect(conversation(page).getByText('Explain my numbers')).toHaveCount(0);
    await page.reload();
    await expect(conversation(page).getByText('Explain my numbers')).toHaveCount(0);
  });

  test('a chat survives a reload', async ({ page }) => {
    await visit(page, '/coach');
    await ask(page, 'Explain my numbers');
    await expect(conversation(page).getByRole('article').last()).toContainText('Built-in answer', {
      timeout: 30_000,
    });
    await page.reload();
    await expect(conversation(page).getByText('Explain my numbers')).toBeVisible();
  });
});
