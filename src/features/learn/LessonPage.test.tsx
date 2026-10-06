import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSON_BY_ID, type Lesson } from '@/data/content';
import { XP_LESSON_PASS, XP_LESSON_PERFECT_BONUS, game, gameActions, getGameState } from '@/game';
import { resetSfx } from '@/lib/sfx';
import { emitPulse } from '@/world';
import LessonPage from './LessonPage';
import { optionOrder, type OptionIndex } from './model/quiz';
import { QUIZ_DRAFTS_KEY, readQuizDraft, resetQuizDraftFallback } from './model/quizDrafts';
import { READ_OPEN_MS } from './model/reading';
import { at, lessonProgressOf, seed, xp } from './testHarness';

const route = vi.hoisted(() => ({ lessonId: 'big-levers' }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lessonId: route.lessonId }),
  usePathname: () => `/learn/${route.lessonId}`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The reader has no stage; a passed quiz still asks the Grove to celebrate.
vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  emitPulse: vi.fn(),
}));

// The reader is a long page and role queries walk all of it in jsdom; a busy machine needs room.
vi.setConfig({ testTimeout: 30_000 });

let now = at(10, 31);

const lessonOf = (id: string): Lesson => {
  const lesson = LESSON_BY_ID.get(id);
  if (!lesson) throw new Error(`no lesson ${id}`);
  return lesson;
};

const quiz = () => within(screen.getByRole('region', { name: 'Three quick questions' }));

/** The answer buttons of the question on screen, in the order they are shown. */
const options = () => within(quiz().getByRole('list')).getAllByRole('button');

/**
 * Clicks the right (or a wrong) answer of question `index`. Options are shuffled per user,
 * question and attempt, so the button is found with the same rule the page uses.
 */
async function answer(
  user: ReturnType<typeof userEvent.setup>,
  lesson: Lesson,
  index: number,
  attempt: number,
  right: boolean,
): Promise<void> {
  const question = lesson.quiz[index];
  if (!question) throw new Error('no question');
  const order = optionOrder(getGameState().profile.userSeed, question.id, attempt);
  const wanted: OptionIndex = right
    ? question.correct
    : (((question.correct + 1) % 3) as OptionIndex);
  const button = options()[order.indexOf(wanted)];
  if (!button) throw new Error('no option');
  await user.click(button);
}

/** Plays a whole attempt and opens the result. */
async function play(
  user: ReturnType<typeof userEvent.setup>,
  lesson: Lesson,
  attempt: number,
  rights: readonly [boolean, boolean, boolean],
): Promise<void> {
  for (const [index, right] of rights.entries()) {
    await answer(user, lesson, index, attempt, right);
    await user.click(
      quiz().getByRole('button', { name: index === 2 ? 'See result' : 'Next question' }),
    );
  }
}

beforeEach(() => {
  now = at(10, 31);
  route.lessonId = 'big-levers';
  game.setClock(() => now);
  resetSfx();
  resetQuizDraftFallback();
  vi.mocked(emitPulse).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  game.setClock(() => Date.now());
  gameActions.resetAll();
});

describe('the reader', () => {
  it('prints the lesson: title, sections, pull-stats and numbered sources', () => {
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);

    expect(screen.getByRole('heading', { level: 1, name: lesson.title })).toBeInTheDocument();
    const article = within(screen.getByRole('article', { name: lesson.title }));
    for (const section of lesson.sections) {
      expect(article.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
    // Every pull-stat carries the honesty mark that opens its paper trail.
    const stats = lesson.sections.flatMap((section) =>
      section.blocks.filter((block) => block.kind === 'fact'),
    );
    expect(article.getAllByRole('button', { name: 'About this estimate' })).toHaveLength(
      stats.length,
    );

    const sources = within(article.getByRole('region', { name: 'Sources' }));
    const items = sources.getAllByRole('listitem');
    expect(items).toHaveLength(lesson.sources.length);
    lesson.sources.forEach((source, index) => {
      const item = within(items[index] as HTMLElement);
      const external = item.getByRole('link', { name: new RegExp('opens in a new tab') });
      expect(external).toHaveAttribute('href', source.url);
      expect(external).toHaveAttribute('target', '_blank');
      expect(external).toHaveAttribute('rel', 'noopener noreferrer');
      expect(item.getByRole('link', { name: `Our notes: ${source.title}` })).toHaveAttribute(
        'href',
        `/methodology#source-${source.key}`,
      );
    });
  });

  it('opens the paper trail of a pull-stat from its honesty mark', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<LessonPage />);

    const mark = screen.getAllByRole('button', { name: 'About this estimate' })[0];
    if (!mark) throw new Error('no mark');
    await user.click(mark);
    const details = within(await screen.findByRole('dialog'));
    expect(details.getByText('How we got this')).toBeInTheDocument();
    expect(details.getByText(/Next review by October 6, 2027\./)).toBeInTheDocument();
    expect(details.getByRole('link', { name: /Open methodology/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/methodology#source-/),
    );
  });

  it('links "do this today" and "do this next" to the log with the action preselected', () => {
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);

    const today = lesson.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.kind === 'action');
    if (!today || today.kind !== 'action') throw new Error('no action block');
    expect(screen.getByRole('link', { name: 'Log it' })).toHaveAttribute(
      'href',
      `/log?a=${today.actionId}&src=lesson`,
    );

    const next = within(screen.getByRole('region', { name: 'Do this next' })).getAllByRole('link');
    expect(next.map((link) => link.getAttribute('href'))).toEqual(
      lesson.doNext.map((item) => `/log?a=${item.actionId}&src=lesson`),
    );
    // Nothing is logged by looking at a lesson.
    expect(getGameState().logs.some((log) => log.source === 'lesson')).toBe(false);
  });

  it('records that the lesson was opened, once per visit', () => {
    seed('day12');
    expect(lessonProgressOf('big-levers')).toBeUndefined();
    const { rerender } = render(<LessonPage />);
    rerender(<LessonPage />);

    expect(lessonProgressOf('big-levers')?.openedTs).toBe(now);
    const opens = getGameState().learn.opens.filter((open) => open.id === 'big-levers');
    expect(opens).toHaveLength(1);
  });

  it('marks the lesson read after thirty seconds open', () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'],
    });
    seed('day12');
    render(<LessonPage />);
    expect(lessonProgressOf('big-levers')?.readTs).toBeNull();

    act(() => {
      vi.advanceTimersByTime(READ_OPEN_MS - 2000);
    });
    expect(lessonProgressOf('big-levers')?.readTs).toBeNull();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(lessonProgressOf('big-levers')?.readTs).toBe(now);
  });

  it('marks the lesson read once four fifths of it are scrolled past, and shows the progress', () => {
    seed('day12');
    render(<LessonPage />);
    const article = screen.getByRole('article');
    const place = (top: number) => {
      article.getBoundingClientRect = () =>
        ({ top, height: 2768, bottom: top + 2768, left: 0, right: 600, width: 600 }) as DOMRect;
    };

    // 2768 px of text in a 768 px window: 2000 px of travel. Halfway is not read yet.
    place(-1000);
    fireEvent.scroll(window);
    expect(lessonProgressOf('big-levers')?.readTs).toBeNull();

    place(-1700);
    fireEvent.scroll(window);
    expect(lessonProgressOf('big-levers')?.readTs).toBe(now);
  });

  it('offers the lessons before and after in reading order', () => {
    seed('day12');
    render(<LessonPage />);
    const pager = within(screen.getByRole('navigation', { name: 'More lessons' }));
    const links = pager.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/learn/where-it-comes-from',
      '/learn/on-your-plate',
    ]);
  });
});

describe('an unknown lesson', () => {
  it('says so in the page and links back to the shelf', () => {
    seed('day12');
    route.lessonId = 'no-such-lesson';
    render(<LessonPage />);

    expect(screen.getByRole('heading', { name: 'Lesson not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Learn' })).toHaveAttribute('href', '/learn');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Three quick questions' })).not.toBeInTheDocument();
    // Nothing is recorded for a lesson that does not exist.
    expect(getGameState().learn.lessons['no-such-lesson']).toBeUndefined();
    expect(getGameState().learn.opens.some((open) => open.id === 'no-such-lesson')).toBe(false);
  });

  it('survives a slug that cannot be decoded', () => {
    seed('day12');
    route.lessonId = '%E0%A4%A';
    render(<LessonPage />);
    expect(screen.getByRole('heading', { name: 'Lesson not found.' })).toBeInTheDocument();
  });
});

describe('the quiz', () => {
  it('waits to be started and says what it is worth', () => {
    seed('day12');
    render(<LessonPage />);
    expect(quiz().getByText('3 questions, 30 XP the first time you pass')).toBeInTheDocument();
    expect(quiz().getByRole('button', { name: 'Start quiz' })).toBeInTheDocument();
    expect(quiz().queryByRole('list')).not.toBeInTheDocument();
  });

  it('asks one question at a time and explains every answer', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);
    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));

    expect(quiz().getByText('Question 1 of 3')).toBeInTheDocument();
    expect(options()).toHaveLength(3);
    expect(quiz().queryByRole('button', { name: 'Next question' })).not.toBeInTheDocument();

    // A wrong answer: kind words, the right answer named, and the reason.
    await answer(user, lesson, 0, 0, false);
    const feedback = quiz()
      .getAllByRole('status')
      .find((region) => region.textContent?.includes('Not quite.'));
    expect(feedback).toHaveTextContent('Right answer:');
    expect(feedback).toHaveTextContent(lesson.quiz[0].explanation.slice(0, 24));
    // The options lie flat: answering twice is not possible.
    for (const option of options()) expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(quiz().getByText('Your answer')).toBeInTheDocument();
    expect(quiz().getByText('Right answer')).toBeInTheDocument();
    await user.click(options()[0] as HTMLElement);
    expect(readQuizDraft('big-levers')?.answers).toHaveLength(1);

    await user.click(quiz().getByRole('button', { name: 'Next question' }));
    expect(quiz().getByText('Question 2 of 3')).toBeInTheDocument();
    // Focus follows the quiz to the new question.
    expect(quiz().getByRole('heading', { level: 3 })).toHaveFocus();

    await answer(user, lesson, 1, 0, true);
    const praise = quiz()
      .getAllByRole('status')
      .find((region) => region.textContent?.includes('Correct.'));
    expect(praise).toHaveTextContent(lesson.quiz[1].explanation.slice(0, 24));
  });

  it('passes at two of three and pays 30 XP, once', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);
    const before = xp();

    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));
    await play(user, lesson, 0, [true, false, true]);

    expect(quiz().getByRole('heading', { name: '2 of 3. Passed.' })).toHaveFocus();
    expect(quiz().getByText('+30 XP for your first pass.')).toBeInTheDocument();
    expect(xp()).toBe(before + XP_LESSON_PASS);
    expect(lessonProgressOf('big-levers')).toMatchObject({
      attempts: 1,
      bestScore: 2,
      firstAttemptScore: 2,
      passedTs: now,
    });
    expect(emitPulse).toHaveBeenCalledWith({ kind: 'celebrate' });
    // The draft is gone and the next unpassed lesson is offered.
    expect(readQuizDraft('big-levers')).toBeNull();
    expect(quiz().getByRole('link', { name: 'Next lesson' })).toHaveAttribute(
      'href',
      '/learn/on-your-plate',
    );

    // A retake that also passes, even perfectly, pays nothing more.
    await user.click(quiz().getByRole('button', { name: 'Retake quiz' }));
    await play(user, lesson, 1, [true, true, true]);
    expect(quiz().getByRole('heading', { name: 'Three for three.' })).toBeInTheDocument();
    expect(quiz().getByText(/XP is paid once per lesson/)).toBeInTheDocument();
    expect(xp()).toBe(before + XP_LESSON_PASS);
    expect(lessonProgressOf('big-levers')).toMatchObject({ attempts: 2, bestScore: 3 });
    expect(emitPulse).toHaveBeenCalledTimes(1);
  });

  it('adds the bonus for three of three on the very first attempt', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);
    const before = xp();

    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));
    await play(user, lesson, 0, [true, true, true]);

    expect(quiz().getByRole('heading', { name: 'Three for three.' })).toBeInTheDocument();
    expect(xp()).toBe(before + XP_LESSON_PASS + XP_LESSON_PERFECT_BONUS);
    expect(
      quiz().getByText(/\+40 XP: 30 for the pass, 10 for a clean first try\./),
    ).toBeInTheDocument();
  });

  it('never pays or scolds for a miss, and lets the user try again', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    render(<LessonPage />);
    const before = xp();

    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));
    await play(user, lesson, 0, [true, false, false]);

    expect(quiz().getByRole('heading', { name: '1 of 3 this time.' })).toBeInTheDocument();
    expect(quiz().getByText(/2 of 3 passes\. Try again\? No penalty/)).toBeInTheDocument();
    expect(xp()).toBe(before);
    expect(lessonProgressOf('big-levers')).toMatchObject({ attempts: 1, passedTs: null });
    expect(emitPulse).not.toHaveBeenCalled();

    // The retry is a new attempt and a pass on it still pays the 30 XP (but no bonus).
    await user.click(quiz().getByRole('button', { name: 'Try again' }));
    expect(quiz().getByText('Question 1 of 3')).toBeInTheDocument();
    await play(user, lesson, 1, [true, true, true]);
    expect(xp()).toBe(before + XP_LESSON_PASS);
    expect(lessonProgressOf('big-levers')).toMatchObject({ attempts: 2, bestScore: 3 });
  });

  it('picks an abandoned quiz up at the first unanswered question', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    const first = render(<LessonPage />);
    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));
    await answer(user, lesson, 0, 0, true);
    first.unmount();

    // The page was closed on the first feedback. Nothing is recorded as an attempt yet.
    expect(lessonProgressOf('big-levers')?.attempts).toBe(0);
    expect(JSON.parse(localStorage.getItem(QUIZ_DRAFTS_KEY) ?? '{}')).toHaveProperty('big-levers');

    render(<LessonPage />);
    expect(quiz().getByText('Question 2 of 3')).toBeInTheDocument();
    expect(quiz().getByText('Picked up where you left off.')).toBeInTheDocument();
    expect(quiz().getByRole('progressbar', { name: 'Quiz progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );

    // Finishing it counts the answer given before the break.
    await answer(user, lesson, 1, 0, true);
    await user.click(quiz().getByRole('button', { name: 'Next question' }));
    await answer(user, lesson, 2, 0, false);
    await user.click(quiz().getByRole('button', { name: 'See result' }));
    expect(quiz().getByRole('heading', { name: '2 of 3. Passed.' })).toBeInTheDocument();
  });

  it('keeps the score when the page is closed on the last feedback, before the result', async () => {
    const user = userEvent.setup();
    seed('day12');
    const lesson = lessonOf('big-levers');
    const { unmount } = render(<LessonPage />);
    const before = xp();

    await user.click(quiz().getByRole('button', { name: 'Start quiz' }));
    await answer(user, lesson, 0, 0, true);
    await user.click(quiz().getByRole('button', { name: 'Next question' }));
    await answer(user, lesson, 1, 0, true);
    await user.click(quiz().getByRole('button', { name: 'Next question' }));
    await answer(user, lesson, 2, 0, true);
    expect(quiz().getByRole('button', { name: 'See result' })).toBeInTheDocument();

    // The store took the score with the third answer: nothing is left to resume, nothing is lost.
    expect(xp()).toBe(before + XP_LESSON_PASS + XP_LESSON_PERFECT_BONUS);
    expect(readQuizDraft('big-levers')).toBeNull();
    unmount();

    render(<LessonPage />);
    expect(quiz().getByText(/Passed, 3 of 3/)).toBeInTheDocument();
    expect(quiz().getByRole('button', { name: 'Retake quiz' })).toBeInTheDocument();
    expect(xp()).toBe(before + XP_LESSON_PASS + XP_LESSON_PERFECT_BONUS);
  });

  it('shows the score of a passed lesson and keeps it re-readable', () => {
    seed('day12');
    route.lessonId = 'the-blanket';
    render(<LessonPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The blanket');
    expect(screen.getByText('Passed, 2 of 3.')).toBeInTheDocument();
    expect(quiz().getByText(/Passed, 2 of 3\. The XP was paid the first time/)).toBeInTheDocument();
    expect(quiz().getByRole('button', { name: 'Retake quiz' })).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
