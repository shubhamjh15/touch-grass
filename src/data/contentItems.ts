/**
 * Flattens every piece of learning content into one list so a single test, and the claims
 * register on the methodology page, can treat lessons, myths, facts and editorial posts alike.
 */
import { EDITORIAL_POSTS } from './editorial';
import { FACTS } from './facts';
import { LESSONS } from './lessons';
import type { Claim, Lesson } from './lessons/types';
import { MYTHS } from './myths';

export type ContentKind = 'lesson' | 'myth' | 'fact' | 'editorial';

export interface ContentItem {
  kind: ContentKind;
  id: string;
  /** Human-readable name used in test titles and the register. */
  label: string;
  /** Everything a reader sees that can carry a figure. Wrong answers of a quiz are left out. */
  text: string;
  claims: readonly Claim[];
  /** Source keys the item cites, in its sources list and in callouts. */
  sourceKeys: readonly string[];
  reviewBy: string;
}

function lessonText(lesson: Lesson): string {
  const parts: string[] = [lesson.title, lesson.summary];
  for (const section of lesson.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'p':
          parts.push(block.text);
          break;
        case 'fact':
          parts.push(block.stat, block.text);
          break;
        case 'list':
          parts.push(...block.items);
          break;
        case 'action':
          parts.push(block.text);
          break;
      }
    }
  }
  for (const question of lesson.quiz) {
    parts.push(question.prompt, question.options[question.correct], question.explanation);
  }
  return parts.join('\n');
}

function lessonSourceKeys(lesson: Lesson): string[] {
  const keys = lesson.sources.map((source) => source.key);
  for (const section of lesson.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'fact') keys.push(block.source);
    }
  }
  return keys;
}

/** Every item that prints figures, in reading order. */
export function allContentItems(): readonly ContentItem[] {
  const lessons = LESSONS.map<ContentItem>((lesson) => ({
    kind: 'lesson',
    id: lesson.id,
    label: `lesson ${lesson.id}`,
    text: lessonText(lesson),
    claims: lesson.claims,
    sourceKeys: lessonSourceKeys(lesson),
    reviewBy: lesson.reviewBy,
  }));
  const myths = MYTHS.map<ContentItem>((myth) => ({
    kind: 'myth',
    id: myth.id,
    label: `myth ${myth.id}`,
    text: [myth.myth, myth.verdictLabel, myth.explanation].join('\n'),
    claims: myth.claims,
    sourceKeys: myth.sources.map((source) => source.key),
    reviewBy: myth.reviewBy,
  }));
  const facts = FACTS.map<ContentItem>((fact) => ({
    kind: 'fact',
    id: fact.id,
    label: `fact ${fact.id}`,
    text: fact.text,
    claims: fact.claims,
    sourceKeys: [fact.source, ...fact.claims.map((claim) => claim.source)],
    reviewBy: fact.reviewBy,
  }));
  const posts = EDITORIAL_POSTS.map<ContentItem>((post) => ({
    kind: 'editorial',
    id: post.id,
    label: `editorial ${post.id}`,
    text: [post.title, post.body].join('\n'),
    claims: post.claims,
    sourceKeys: post.sources.map((source) => source.key),
    reviewBy: post.reviewBy,
  }));
  return [...lessons, ...myths, ...facts, ...posts];
}

export interface RegisterRow {
  item: string;
  kind: ContentKind;
  figure: string;
  statement: string;
  source: string;
  basis: Claim['basis'];
  note: string | null;
}

/** The claims register: one row per printed figure, with where it comes from. */
export function claimsRegister(): readonly RegisterRow[] {
  return allContentItems().flatMap((item) =>
    item.claims.map((claim) => ({
      item: item.label,
      kind: item.kind,
      figure: claim.figure,
      statement: claim.statement,
      source: claim.source,
      basis: claim.basis,
      note: claim.note ?? null,
    })),
  );
}
