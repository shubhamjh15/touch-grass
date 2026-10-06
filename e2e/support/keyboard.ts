import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Keyboard-only helpers: nothing here clicks. A person who cannot use a pointer presses Tab
 * until the thing they want has focus, then Enter or Space.
 */

/** Presses Tab (or Shift+Tab) until `target` has focus; fails after `limit` presses. */
export async function tabTo(
  page: Page,
  target: Locator,
  options: { limit?: number; backwards?: boolean } = {},
): Promise<void> {
  const limit = options.limit ?? 80;
  const key = options.backwards ? 'Shift+Tab' : 'Tab';
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((node) => node === document.activeElement).catch(() => false)) return;
    await page.keyboard.press(key);
  }
  await expect(target, `focus never reached the target in ${limit} Tab presses`).toBeFocused();
}

/** The text of what has focus, for failure messages. */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const node = document.activeElement;
    if (!node || node === document.body) return '(nothing)';
    return `${node.tagName.toLowerCase()} ${node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 40) ?? ''}`;
  });
}
