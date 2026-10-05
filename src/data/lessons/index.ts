import { BIG_LEVERS } from './bigLevers';
import { FOOD_WE_NEVER_EAT } from './foodWeNeverEat';
import { GETTING_AROUND } from './gettingAround';
import { GOOD_NEWS } from './goodNews';
import { ON_YOUR_PLATE } from './onYourPlate';
import { POWER_AT_HOME } from './powerAtHome';
import { RECYCLING_HONESTLY } from './recyclingHonestly';
import { STUFF } from './stuff';
import { THE_BLANKET } from './theBlanket';
import { WHERE_IT_COMES_FROM } from './whereItComesFrom';
import type { Lesson, LessonCategory, LessonCategoryId } from './types';

export * from './types';
export { CONTENT_SOURCES, sourcesFor, type ContentSourceKey } from './sources';

/** Chips on the lesson cards, in the order the filter shows them. */
export const LESSON_CATEGORIES: readonly LessonCategory[] = [
  { id: 'climate', label: 'Climate', emoji: '🌍' },
  { id: 'action', label: 'Action', emoji: '🎯' },
  { id: 'eat', label: 'Eat', emoji: '🥗' },
  { id: 'move', label: 'Move', emoji: '🚲' },
  { id: 'power', label: 'Power', emoji: '⚡' },
  { id: 'stuff', label: 'Stuff', emoji: '🧵' },
  { id: 'waste', label: 'Waste', emoji: '♻️' },
  { id: 'hope', label: 'Hope', emoji: '🌱' },
];

export const LESSON_CATEGORY_BY_ID: Readonly<Record<LessonCategoryId, LessonCategory>> =
  Object.fromEntries(LESSON_CATEGORIES.map((category) => [category.id, category])) as Record<
    LessonCategoryId,
    LessonCategory
  >;

/** The ten lessons, in reading order. All are open from the start. */
export const LESSONS: readonly Lesson[] = [
  THE_BLANKET,
  WHERE_IT_COMES_FROM,
  BIG_LEVERS,
  ON_YOUR_PLATE,
  FOOD_WE_NEVER_EAT,
  GETTING_AROUND,
  POWER_AT_HOME,
  STUFF,
  RECYCLING_HONESTLY,
  GOOD_NEWS,
];

export const LESSON_IDS: readonly string[] = LESSONS.map((lesson) => lesson.id);

export const LESSON_BY_ID: ReadonlyMap<string, Lesson> = new Map(
  LESSONS.map((lesson) => [lesson.id, lesson]),
);
