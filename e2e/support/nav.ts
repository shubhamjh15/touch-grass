import { expect, type Page } from '@playwright/test';

/**
 * Follows a link of the product's own navigation, the way a person would: the top bar on a
 * wide screen, the tab bar on a phone, and the More sheet for what neither shows.
 */
export async function goTo(page: Page, name: string): Promise<void> {
  if (name === 'Me') {
    // On a wide screen the passport is the tree's name in the top bar; on a phone it is in More.
    const passport = page
      .getByRole('link', { name: /: passport and settings$/ })
      .filter({ visible: true });
    if ((await passport.count()) > 0) {
      await passport.first().click();
      return;
    }
  }
  // On a phone the Log tab is the green sticker, whose spoken name is "Log an action".
  const direct = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', name === 'Log' ? { name: /^Log( an action)?$/ } : { name, exact: true });
  const total = await direct.count();
  for (let index = 0; index < total; index += 1) {
    const link = direct.nth(index);
    if (await link.isVisible()) {
      await link.click();
      return;
    }
  }
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  // A menu on a laptop, a sheet of links on a phone.
  const label = new RegExp(`^${name}\\b`);
  const inMore = page
    .getByRole('menuitem', { name: label })
    .or(page.getByRole('link', { name: label }))
    .filter({ visible: true });
  await expect(inMore.first()).toBeVisible();
  await inMore.first().click();
}
