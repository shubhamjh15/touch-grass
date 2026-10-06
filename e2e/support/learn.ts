import { expect, type Locator, type Page } from '@playwright/test';
import { LESSONS } from '../../src/data/lessons';

/**
 * Answering a lesson's quiz without knowing the shuffle: the question is found by its prompt
 * and the option by its text, both read from the same lesson data the app renders. The page
 * draws a few glyphs (the approximate sign, arrows, CO2e) instead of printing them, so a
 * text is matched by its longest plain stretch.
 */

function plainStretch(text: string): string {
  const parts = text.split(/≈|→|___|CO2e?|["'’‘“”]/).map((part) => part.trim());
  return parts.sort((a, b) => b.length - a.length)[0] ?? text;
}

export function quizOf(slug: string) {
  const lesson = LESSONS.find((entry) => entry.id === slug);
  if (!lesson) throw new Error(`no lesson ${slug}`);
  return lesson.quiz;
}

export const quizRegion = (page: Page): Locator =>
  page.getByRole('region', { name: 'Three quick questions' });

/**
 * Answers the question on screen. `right` picks the correct option; otherwise the next
 * wrong one. Returns once the feedback is showing.
 */
export async function answerCurrent(page: Page, slug: string, right: boolean): Promise<void> {
  const region = quizRegion(page);
  const prompt = (await region.getByRole('heading', { level: 3 }).first().textContent()) ?? '';
  const question = quizOf(slug).find((entry) => prompt.includes(plainStretch(entry.prompt)));
  if (!question) throw new Error(`no question matches "${prompt}"`);
  const index = right ? question.correct : (question.correct + 1) % 3;
  const option = region
    .getByRole('listitem')
    .filter({ hasText: plainStretch(question.options[index]) })
    .getByRole('button');
  await option.click();
  await expect(region.getByRole('status')).toContainText(right ? 'Correct.' : 'Not quite.');
}

/** Runs a whole attempt: one boolean per question (true is a right answer) and ends on the result. */
export async function takeQuiz(
  page: Page,
  slug: string,
  answers: readonly [boolean, boolean, boolean],
): Promise<void> {
  const region = quizRegion(page);
  await region.getByRole('button', { name: /^(Start quiz|Retake quiz|Try again)$/ }).click();
  for (const [index, right] of answers.entries()) {
    await answerCurrent(page, slug, right);
    await region
      .getByRole('button', { name: index === 2 ? 'See result' : 'Next question' })
      .click();
  }
}
