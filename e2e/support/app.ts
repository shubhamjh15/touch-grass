import { expect, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../../src/game/types';
import { GAME_KEY } from './seeds';

/** What a person sees in the HUD (the numbers the shell keeps on screen). */
export interface Hud {
  level: number;
  streak: number;
  /** Whole kilograms of CO2e avoided, as the HUD prints them. */
  kg: number | null;
  xpInto: number;
  xpOf: number;
}

/** The persisted game state, read from the same storage a reload would read. */
export async function savedGame(page: Page): Promise<GameState> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), GAME_KEY);
  if (!raw) throw new Error('nothing saved under the game key');
  return (JSON.parse(raw) as { state: GameState }).state;
}

/** Waits for the save to hold `check` true (saves are written a moment after a change). */
export async function savedWhere<T>(
  page: Page,
  read: (state: GameState) => T,
  expected: T,
): Promise<void> {
  await expect.poll(async () => read(await savedGame(page))).toEqual(expected);
}

/** Reads the HUD from the labels a screen reader would hear, on desktop and on phones. */
export async function readHud(page: Page): Promise<Hud> {
  const group = page.getByRole('group', { name: 'Your progress' });
  const phone = !(await group.isVisible());
  if (phone) {
    const level = await page
      .getByRole('button', { name: /^.*: level \d+\./ })
      .first()
      .getAttribute('aria-label');
    const streak = await page
      .getByRole('button', { name: /^Streak: / })
      .first()
      .getAttribute('aria-label');
    return {
      level: Number(/level (\d+)/.exec(level ?? '')?.[1]),
      streak: Number(/Streak: (\d+)/.exec(streak ?? '')?.[1]),
      kg: null,
      xpInto: 0,
      xpOf: 0,
    };
  }
  const level = await group.getByRole('link', { name: /^Level \d+/ }).getAttribute('aria-label');
  const streak = await group.getByRole('button', { name: /^Streak: / }).getAttribute('aria-label');
  // The kilogram cell only fits the top bar from 1440 px.
  const kgLink = group.getByRole('link', { name: /kg of CO2e avoided/ });
  const kg = (await kgLink.count()) > 0 ? await kgLink.getAttribute('aria-label') : null;
  const xp = /(\d[\d,]*) of (\d[\d,]*) XP/.exec(level ?? '');
  return {
    level: Number(/Level (\d+)/.exec(level ?? '')?.[1]),
    streak: Number(/Streak: (\d+)/.exec(streak ?? '')?.[1]),
    kg: kg === null ? null : Number(/About ([\d.,]+) kg/.exec(kg)?.[1]?.replace(/,/g, '')),
    xpInto: Number(xp?.[1]?.replace(/,/g, '')),
    xpOf: Number(xp?.[2]?.replace(/,/g, '')),
  };
}

/** The shared fake clock, in saved-state time: moves it forward and lets the app settle the calendar. */
export async function advance(page: Page, duration: string | number): Promise<void> {
  await page.clock.fastForward(duration);
}

/**
 * Stops the app's clock where it is (timers keep running). Anything the app times in
 * seconds, like the eight-second Undo window, then lasts as long as the test needs
 * however busy the machine is.
 */
export async function holdClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(now);
}

/** The visible, enabled option of a radio group by its label text. */
export function radio(scope: Page | Locator, name: string | RegExp): Locator {
  return scope.getByRole('radio', { name });
}

/**
 * Runs the first-run flow up to (not including) the planting screen.
 * `quiz: true` answers the six questions with the first option each.
 */
export async function walkOnboarding(
  page: Page,
  options: {
    name?: string;
    species?: 'Oak' | 'Cherry blossom' | 'Pine';
    treeName?: string;
    quiz: boolean;
  },
): Promise<void> {
  await page.getByRole('button', { name: "Let's plant" }).click();
  if (options.name) await page.getByRole('textbox', { name: 'Your name' }).fill(options.name);
  await page.getByRole('button', { name: 'Next' }).click();
  if (options.species) await page.getByText(options.species, { exact: true }).first().click();
  if (options.treeName)
    await page.getByRole('textbox', { name: /^Name it/ }).fill(options.treeName);
  await page.getByRole('button', { name: 'Next' }).click();
  if (!options.quiz) {
    await page.getByRole('button', { name: /^Skip for now/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick up to three.');
    await page.getByRole('button', { name: 'Next' }).click();
  } else {
    await page.getByRole('button', { name: /^Take the 60-second quiz/ }).click();
    // The home region is the first question; the default (world average) is fine.
    await page.getByRole('button', { name: 'Next' }).click();
    for (let question = 0; question < 6; question += 1) {
      const heading = page.getByRole('heading', { level: 1 });
      const text = (await heading.textContent()) ?? '';
      await page.getByRole('group', { name: text }).getByRole('button').first().click();
      await expect(heading).not.toHaveText(text);
    }
    await page.getByRole('button', { name: 'Use these as my focus' }).click();
  }
  await page.getByRole('button', { name: 'Go plant' }).click();
}

/** Plants with the plain button (the press-and-hold has its own spec) and lands on Today. */
export async function plantTree(
  page: Page,
  options: Parameters<typeof walkOnboarding>[1],
): Promise<void> {
  await walkOnboarding(page, options);
  await page.getByRole('button', { name: 'Plant', exact: true }).click();
  await page.getByRole('button', { name: /^Give .* its first leaf$/ }).click();
  await expect(page).toHaveURL(/\/today$/);
}

/** Onboarding keeps a resume point in the save, but nothing is planted until the ceremony is confirmed. */
export async function expectNothingPlanted(page: Page): Promise<void> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), GAME_KEY);
  if (raw === null) return;
  const state = (JSON.parse(raw) as { state: GameState }).state;
  expect(state.onboarding.completedAt).toBeNull();
  expect(state.tree.rings).toBe(0);
  expect(state.xp).toBe(0);
}
