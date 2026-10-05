/**
 * Shapes of the Learn content: lessons, quizzes, myth-busters and daily facts. Data only; the
 * rules (XP, pass mark, states) live in `src/game`. Every figure in the prose is backed by a
 * `claims` entry that names its source key, and `content.test.ts` checks that none is missing.
 */
import type { CatalogueActionId } from '../catalogue/actions';
import type { CategoryId } from '../catalogue/types';

/** A source as shown in a sources list. The `key` joins it with the methodology page. */
export interface SourceRef {
  key: string;
  title: string;
  publisher: string;
  url: string;
  year: number;
}

export type LessonCategoryId =
  'climate' | 'action' | 'eat' | 'move' | 'power' | 'stuff' | 'waste' | 'hope';

export interface LessonCategory {
  id: LessonCategoryId;
  label: string;
  emoji: string;
}

/** How a number in the text was checked. */
export type ClaimBasis =
  /** Read from one of the bundled datasets in `src/data/datasets`. */
  | 'dataset'
  /** Read from the evidence base (the same files the action catalogue is generated from). */
  | 'evidence-base'
  /** Checked against the publisher's own page or a report of it on 2026-10-06. */
  | 'web'
  /** Simple arithmetic on other claims in the same item. */
  | 'derived';

export interface Claim {
  id: string;
  /** The figure exactly as it appears in the text, e.g. "427 ppm". */
  figure: string;
  /** What the figure says, in a sentence a reviewer can check against the source. */
  statement: string;
  /** Key into `CONTENT_SOURCES`. */
  source: string;
  basis: ClaimBasis;
  /** Anything a reviewer should know: a caveat, a scope, how it was derived. */
  note?: string;
}

export type LessonBlock =
  | { kind: 'p'; text: string }
  /** A pull-stat: one number, one line, one source. */
  | { kind: 'fact'; stat: string; text: string; source: string }
  | { kind: 'list'; items: readonly string[] }
  /** The "do this today" link: opens the Log sheet for a catalogue action. */
  | { kind: 'action'; actionId: CatalogueActionId; text: string };

export interface LessonSection {
  id: string;
  heading: string;
  blocks: readonly LessonBlock[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  /** Three options in a fixed canonical order; the page shuffles them for display. */
  options: readonly [string, string, string];
  /** Index into `options`. */
  correct: 0 | 1 | 2;
  /** Shown after the answer, whether it was right or wrong. */
  explanation: string;
}

export interface DoNext {
  actionId: CatalogueActionId;
  /** The chip label, a short verb phrase. */
  label: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** One or two sentences for the lesson card. */
  summary: string;
  category: LessonCategoryId;
  /** Product categories this lesson serves, so "Recommended" can follow the user's focus areas. */
  focus: readonly CategoryId[];
  /** Whole minutes. */
  readingMinutes: number;
  sections: readonly LessonSection[];
  /** Two log chips under the lesson. */
  doNext: readonly [DoNext, DoNext];
  quiz: readonly [QuizQuestion, QuizQuestion, QuizQuestion];
  sources: readonly SourceRef[];
  claims: readonly Claim[];
  /** ISO date by which every claim must be re-checked against its source. */
  reviewBy: string;
}

export type MythVerdict = 'false' | 'mostly-false' | 'misleading' | 'conditional';

export interface Myth {
  id: string;
  /** The claim as people say it, in quotation marks. */
  myth: string;
  verdict: MythVerdict;
  /** The verdict as the card prints it, e.g. "Mostly false." */
  verdictLabel: string;
  /** Two or three short sentences. */
  explanation: string;
  /** Lesson to open from the card. */
  lessonId: string;
  sources: readonly SourceRef[];
  claims: readonly Claim[];
  reviewBy: string;
}

/** Where a daily fact's "Tell me more" link goes. */
export type FactLink = { kind: 'lesson'; lessonId: string } | { kind: 'touch-grass' };

export interface Fact {
  id: string;
  text: string;
  /** Short label printed after the fact, e.g. "ENERGY STAR". */
  sourceLabel: string;
  source: string;
  /** Progress rather than a problem. */
  hopeful: boolean;
  link: FactLink;
  claims: readonly Claim[];
  reviewBy: string;
}
