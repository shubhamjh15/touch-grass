import { expect, test, visit } from './support/test';
import { savedGame } from './support/app';
import { seeded } from './support/seeds';
import { quizRegion, takeQuiz } from './support/learn';
import { XP_LESSON_PASS, XP_LESSON_PERFECT_BONUS } from '../src/game/economy';

test.use({ storageState: seeded('day12') });

const SLUG = 'big-levers';

const lessonProgress = async (page: Parameters<typeof savedGame>[0]) =>
  (await savedGame(page)).learn.lessons[SLUG];

const scrollToEnd = (page: Parameters<typeof savedGame>[0]) =>
  page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

test.describe('reading a lesson', () => {
  test('opening is recorded, reading to the end marks it read, once', async ({ page }) => {
    await visit(page, `/learn/${SLUG}`);
    await expect.poll(async () => (await lessonProgress(page))?.openedTs).toBeTruthy();
    expect((await lessonProgress(page))?.readTs ?? null).toBeNull();

    // Real scrolling is what counts: a lesson on a tall screen is not read on arrival.
    await scrollToEnd(page);
    await expect.poll(async () => (await lessonProgress(page))?.readTs).toBeTruthy();
    const first = (await lessonProgress(page))?.readTs;

    await page.reload();
    await scrollToEnd(page);
    await expect(page.getByRole('region', { name: 'Three quick questions' })).toBeVisible();
    expect((await lessonProgress(page))?.readTs).toBe(first);
  });

  test('half a minute with the lesson open counts as read without scrolling', async ({ page }) => {
    await visit(page, `/learn/${SLUG}`);
    await page.clock.runFor(31_000);
    await expect.poll(async () => (await lessonProgress(page))?.readTs).toBeTruthy();
  });

  test('the shelf counts what is passed and shows what is read', async ({ page }) => {
    await visit(page, `/learn/${SLUG}`);
    await scrollToEnd(page);
    await expect.poll(async () => (await lessonProgress(page))?.readTs).toBeTruthy();
    await page.goto('/learn');
    await expect(page.getByRole('group', { name: 'Your progress in Learn' })).toContainText(
      /Lessons passed\s*1\s*of 10/,
    );
    await expect(page.getByText('Read', { exact: true }).first()).toBeVisible();
  });
});

test.describe('the quiz', () => {
  test('three right on the first try pays 30 XP plus 10, and a retake pays nothing', async ({
    page,
  }) => {
    await visit(page, `/learn/${SLUG}`);
    const before = await savedGame(page);

    await takeQuiz(page, SLUG, [true, true, true]);
    const region = quizRegion(page);
    await expect(region.getByRole('heading', { name: 'Three for three.' })).toBeVisible();
    await expect(region).toContainText(`+${XP_LESSON_PASS + XP_LESSON_PERFECT_BONUS} XP`);

    await expect
      .poll(async () => (await savedGame(page)).xp)
      .toBe(before.xp + XP_LESSON_PASS + XP_LESSON_PERFECT_BONUS);
    const passed = await savedGame(page);
    expect(passed.learn.lessons[SLUG]).toMatchObject({ attempts: 1, bestScore: 3 });
    expect(passed.learn.lessons[SLUG]?.passedTs).toBeTruthy();

    await takeQuiz(page, SLUG, [true, true, true]);
    await expect(region).toContainText('XP is paid once per lesson');
    await expect.poll(async () => (await lessonProgress(page))?.attempts).toBe(2);
    expect((await savedGame(page)).xp).toBe(passed.xp);

    await page.reload();
    expect((await savedGame(page)).xp).toBe(passed.xp);
  });

  test('a miss pays nothing; a later pass pays 30 and never the clean-first-try bonus', async ({
    page,
  }) => {
    await visit(page, `/learn/${SLUG}`);
    const before = await savedGame(page);

    await takeQuiz(page, SLUG, [false, false, true]);
    const region = quizRegion(page);
    await expect(region.getByRole('heading', { name: '1 of 3 this time.' })).toBeVisible();
    await expect.poll(async () => (await lessonProgress(page))?.attempts).toBe(1);
    const missed = await savedGame(page);
    expect(missed.xp).toBe(before.xp);
    expect(missed.learn.lessons[SLUG]?.passedTs ?? null).toBeNull();

    await takeQuiz(page, SLUG, [true, true, false]);
    await expect(region.getByRole('heading', { name: '2 of 3. Passed.' })).toBeVisible();
    await expect.poll(async () => (await savedGame(page)).xp).toBe(before.xp + XP_LESSON_PASS);
    expect((await lessonProgress(page))?.passedTs).toBeTruthy();
  });

  test('a quiz left half done picks up at the next question after a reload', async ({ page }) => {
    await visit(page, `/learn/${SLUG}`);
    const region = quizRegion(page);
    await region.getByRole('button', { name: 'Start quiz' }).click();
    await region.getByRole('listitem').first().getByRole('button').click();
    await expect(region.getByRole('status')).not.toBeEmpty();
    await region.getByRole('button', { name: 'Next question' }).click();
    await expect(region).toContainText('Question 2 of 3');

    await page.reload();
    await expect(quizRegion(page)).toContainText('Picked up where you left off.');
    await expect(quizRegion(page)).toContainText('Question 2 of 3');
  });
});

test.describe('a lesson that is not there', () => {
  test('says so inside the app and points back to the shelf', async ({ page }) => {
    await visit(page, '/learn/no-such-lesson');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Lesson not found.' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Learn' }).click();
    await expect(page).toHaveURL(/\/learn$/);
  });
});
