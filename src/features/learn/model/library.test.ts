import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FACTS, LESSONS } from '@/data/content';
import { game, gameActions, getGameState, selectLearn } from '@/game';
import {
  buildLibrary,
  factByNumber,
  factLesson,
  featuredLesson,
  filterLessons,
  lessonLength,
  lessonNeighbours,
  lessonSlug,
  librarySummary,
  nextUnpassed,
  parseTopic,
  statusText,
  topicCounts,
} from './library';
import type { QuizDraft } from './quiz';

const T0 = new Date(2026, 9, 6, 12).getTime();
let now = T0;

beforeEach(() => {
  now = T0;
  game.setClock(() => now);
  gameActions.resetAll();
  const planted = gameActions.onboard({
    name: 'Maya',
    treeName: 'Fern',
    species: 'oak',
    focus: ['eat'],
  });
  if (!planted.ok) throw new Error(planted.reason);
});

afterEach(() => {
  game.setClock(() => Date.now());
});

const rows = (drafts: Record<string, QuizDraft> = {}) =>
  buildLibrary(selectLearn(getGameState(), now), drafts);

const open = (slug: string, minutesLater = 0) => {
  now = T0 + minutesLater * 60_000;
  gameActions.openLesson(slug);
};

const pass = (slug: string, score = 3) => {
  gameActions.completeLesson(slug, score);
};

describe('the library', () => {
  it('lists the ten lessons in reading order, all new on a first run', () => {
    const library = rows();
    expect(library).toHaveLength(10);
    expect(library.map((row) => row.lesson.id)).toEqual(LESSONS.map((lesson) => lesson.id));
    expect(library.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(library.every((row) => row.status === 'new' && row.quizAnswered === 0)).toBe(true);
    expect(librarySummary(library)).toEqual({ total: 10, passed: 0, started: 0, complete: false });
  });

  it('joins saved progress and unfinished quizzes onto the lessons', () => {
    pass('the-blanket', 3);
    open('stuff');
    gameActions.markLessonRead('stuff');
    const library = rows({
      stuff: { attempt: 0, answers: [1] },
      // Every question answered: that quiz is finished, not "in progress".
      'the-blanket': { attempt: 1, answers: [0, 1, 2] },
    });
    const blanket = library.find((row) => row.lesson.id === 'the-blanket');
    const stuff = library.find((row) => row.lesson.id === 'stuff');
    expect(blanket).toMatchObject({ status: 'passed', bestScore: 3, attempts: 1, quizAnswered: 0 });
    expect(stuff).toMatchObject({ status: 'read', bestScore: 0, quizAnswered: 1 });
    expect(librarySummary(library)).toEqual({ total: 10, passed: 1, started: 1, complete: false });
  });

  it('says a lesson state in words', () => {
    expect(statusText({ status: 'new', bestScore: 0, quizAnswered: 0 })).toBe('New');
    expect(statusText({ status: 'read', bestScore: 1, quizAnswered: 0 })).toBe(
      'Read, quiz not passed yet',
    );
    expect(statusText({ status: 'read', bestScore: 0, quizAnswered: 2 })).toBe(
      'Quiz in progress, 2 of 3 answered',
    );
    expect(statusText({ status: 'passed', bestScore: 2, quizAnswered: 1 })).toBe('Passed, 2 of 3');
  });

  it('prints the mono slug and the length of a lesson', () => {
    expect(lessonSlug(3, 2)).toBe('Lesson 03 · 2 min');
    expect(lessonSlug(10, 3)).toBe('Lesson 10 · 3 min');
    expect(lessonLength({ readingMinutes: 3 })).toBe('3 min read · 3 questions');
  });
});

describe('the featured lesson', () => {
  it('starts a first run at lesson 1', () => {
    const featured = featuredLesson(rows(), selectLearn(getGameState(), now).recommended);
    expect(featured).toMatchObject({ reason: 'start' });
    expect(featured?.row.lesson.id).toBe('the-blanket');
  });

  it('puts an unfinished quiz before everything else', () => {
    open('the-blanket', 1);
    open('getting-around', 2);
    const featured = featuredLesson(
      rows({ 'on-your-plate': { attempt: 0, answers: [2, 0] } }),
      'the-blanket',
    );
    expect(featured?.reason).toBe('resume-quiz');
    expect(featured?.row.lesson.id).toBe('on-your-plate');
  });

  it('continues the lesson opened most recently and not passed', () => {
    open('the-blanket', 1);
    open('getting-around', 5);
    open('stuff', 3);
    pass('getting-around', 2);
    const featured = featuredLesson(rows(), null);
    expect(featured?.reason).toBe('continue');
    expect(featured?.row.lesson.id).toBe('stuff');
  });

  it("follows the engine's recommendation once nothing is half-done", () => {
    gameActions.updateProfile({ focus: ['waste'] });
    pass('the-blanket', 3);
    const board = selectLearn(getGameState(), now);
    expect(board.recommended).toBe('food-we-never-eat');
    const featured = featuredLesson(rows(), board.recommended);
    expect(featured?.reason).toBe('recommended');
    expect(featured?.row.lesson.id).toBe('food-we-never-eat');
  });

  it('falls back to the first unpassed lesson when the recommendation is stale', () => {
    pass('the-blanket', 2);
    const featured = featuredLesson(rows(), 'no-such-lesson');
    expect(featured?.row.lesson.id).toBe('where-it-comes-from');
  });

  it('has nothing to feature when all ten are passed', () => {
    for (const lesson of LESSONS) pass(lesson.id, 2);
    const library = rows();
    expect(featuredLesson(library, null)).toBeNull();
    expect(librarySummary(library)).toMatchObject({ passed: 10, complete: true });
  });
});

describe('the topic filter', () => {
  it('reads the URL parameter and treats anything unknown as "all"', () => {
    expect(parseTopic('eat')).toBe('eat');
    expect(parseTopic('hope')).toBe('hope');
    expect(parseTopic('water')).toBe('all');
    expect(parseTopic('')).toBe('all');
    expect(parseTopic(null)).toBe('all');
    expect(parseTopic('constructor')).toBe('all');
  });

  it('filters lessons and counts them per topic', () => {
    const library = rows();
    const counts = topicCounts(library);
    expect(counts.all).toBe(10);
    expect(counts.eat).toBe(2);
    expect(counts.climate).toBe(2);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(20);
    expect(filterLessons(library, 'eat').map((row) => row.lesson.id)).toEqual([
      'on-your-plate',
      'food-we-never-eat',
    ]);
    expect(filterLessons(library, 'all')).toHaveLength(10);
  });
});

describe('finding the way around', () => {
  it('knows the neighbours of a lesson', () => {
    expect(lessonNeighbours('the-blanket')).toMatchObject({ number: 1, previous: null });
    expect(lessonNeighbours('the-blanket')?.next?.id).toBe('where-it-comes-from');
    expect(lessonNeighbours('good-news')).toMatchObject({ number: 10, next: null });
    expect(lessonNeighbours('nope')).toBeNull();
  });

  it('offers the next unpassed lesson, wrapping round the shelf', () => {
    pass('where-it-comes-from', 3);
    pass('big-levers', 2);
    expect(nextUnpassed(rows(), 'the-blanket')?.lesson.id).toBe('on-your-plate');
    expect(nextUnpassed(rows(), 'good-news')?.lesson.id).toBe('the-blanket');
    expect(nextUnpassed(rows(), 'nope')).toBeNull();
  });

  it('offers nothing once every other lesson is passed', () => {
    for (const lesson of LESSONS) pass(lesson.id, 3);
    expect(nextUnpassed(rows(), 'stuff')).toBeNull();
  });
});

describe('daily facts', () => {
  it('finds a fact by the engine number and its lesson', () => {
    expect(factByNumber(1)).toBe(FACTS[0]);
    expect(factByNumber(30)).toBe(FACTS[29]);
    expect(factByNumber(0)).toBeNull();
    expect(factByNumber(31)).toBeNull();
    const first = factByNumber(1);
    expect(first && factLesson(first)?.id).toBe('power-at-home');
  });

  it('has no lesson for the fact that opens the Touch grass break', () => {
    const outside = FACTS.find((fact) => fact.link.kind === 'touch-grass');
    expect(outside).toBeDefined();
    expect(outside && factLesson(outside)).toBeNull();
  });
});
