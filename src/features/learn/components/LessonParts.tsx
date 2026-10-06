'use client';

import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { ROUTES, logLink } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import type { Lesson } from '@/data/content';
import { cn } from '@/lib/cn';
import { Button, Card, EmptyState, SectionHeading, Stamp, Sticker, Tag, UiLink } from '@/ui';
import { LEARN_COPY } from '../copy';
import { lessonSlug, statusText, type LessonNeighbours, type LessonRow } from '../model/library';
import { richText } from '../model/richText';
import { TOPIC_BY_ID } from '../model/topics';

/** The way back to the shelf, as a small pressable chip above the lesson. */
export function BackToLearn() {
  return (
    <Button asChild variant="neutral" size="sm" icon={ArrowLeft}>
      <UiLink href={ROUTES.learn}>{LEARN_COPY.backToLearn}</UiLink>
    </Button>
  );
}

/** Slug, title and lead of a lesson, with its state printed beside the way back. */
export function LessonHeader({ row }: { row: LessonRow }) {
  const { lesson } = row;
  const topic = TOPIC_BY_ID[lesson.category];

  return (
    <header className="pt-1 pb-5 md:pb-6">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <BackToLearn />
        {row.status === 'passed' ? (
          <Stamp
            label={LEARN_COPY.statePassed(row.bestScore)}
            hue="green"
            rotate={-4}
            className="mr-1.5"
          />
        ) : row.status === 'read' ? (
          <Tag hue="paper" aria-hidden="true">
            {LEARN_COPY.stateRead}
          </Tag>
        ) : null}
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-2 type-slug text-ink-3">
        <span>{lessonSlug(row.number, lesson.readingMinutes)}</span>
        <Tag className={topic.tag}>{topic.label}</Tag>
      </p>
      <h1 className="mt-3 text-h1">{richText(lesson.title)}</h1>
      <p className="mt-3 text-lead text-ink-2">{richText(lesson.summary)}</p>
      <p className="sr-only">{statusText(row)}.</p>
    </header>
  );
}

/** The two actions a lesson points at. Each opens the log with that action ready; nothing is logged here. */
export function DoNext({ lesson }: { lesson: Lesson }) {
  return (
    <section aria-label={LEARN_COPY.doNextHeading}>
      <SectionHeading
        className="mt-0"
        title={LEARN_COPY.doNextHeading}
        meta={LEARN_COPY.doNextMeta}
      />
      <ul className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {lesson.doNext.map((next) => {
          const action = ACTION_BY_ID.get(next.actionId);
          return (
            <li key={next.actionId} className="min-w-0">
              <Card
                href={logLink(next.actionId, undefined, 'lesson')}
                className="flex h-full items-center gap-3 p-3 md:p-3.5 lg:p-3.5"
              >
                {action ? (
                  <span aria-hidden="true" className="shrink-0">
                    <Sticker category={action.category} size={44} />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-bold">{richText(next.label)}</span>
                  {action ? (
                    <span className="mt-1.5 block type-slug leading-[1.3] text-ink-3">
                      {LEARN_COPY.doNextRow(action.xp)}
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-sm border-2 border-ink bg-green"
                >
                  <Plus size={16} strokeWidth={2.75} />
                </span>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PagerLink({
  lesson,
  number,
  direction,
}: {
  lesson: Lesson;
  number: number;
  direction: 'previous' | 'next';
}) {
  const next = direction === 'next';
  return (
    <UiLink
      href={ROUTES.lesson(lesson.id)}
      className={cn(
        'group/pager flex min-h-14 min-w-0 flex-1 basis-56 items-center gap-3 rounded-md px-1 py-2',
        next && 'flex-row-reverse text-right',
      )}
    >
      {next ? (
        <ArrowRight size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
      ) : (
        <ArrowLeft size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
      )}
      <span className="min-w-0">
        <span className="block type-slug leading-[1.4] text-ink-3">
          {next ? LEARN_COPY.pagerNext : LEARN_COPY.pagerPrevious} ·{' '}
          {lessonSlug(number, lesson.readingMinutes)}
        </span>
        <span className="mt-1 block text-body-sm font-bold underline-offset-4 fine:group-hover/pager:underline">
          {richText(lesson.title)}
        </span>
      </span>
    </UiLink>
  );
}

/** Previous and next lesson in reading order, at the foot of the page. */
export function LessonPager({ neighbours }: { neighbours: LessonNeighbours }) {
  if (!neighbours.previous && !neighbours.next) return null;
  return (
    <nav
      aria-label={LEARN_COPY.pagerLabel}
      className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t-[1.5px] border-ink pt-3"
    >
      {neighbours.previous ? (
        <PagerLink
          lesson={neighbours.previous}
          number={neighbours.number - 1}
          direction="previous"
        />
      ) : (
        <span className="flex-1 basis-56" />
      )}
      {neighbours.next ? (
        <PagerLink lesson={neighbours.next} number={neighbours.number + 1} direction="next" />
      ) : null}
    </nav>
  );
}

/** A lesson link that leads nowhere: said in the page, with the way back and one lesson to start. */
export function LessonNotFound({ suggestion }: { suggestion: Lesson | null }) {
  return (
    <div className="grid gap-5 pt-1">
      <div className="flex min-h-11 items-center">
        <BackToLearn />
      </div>
      <h1 className="sr-only">Lesson</h1>
      <EmptyState
        as="h2"
        category="stuff"
        slug={LEARN_COPY.notFoundSlug}
        title={LEARN_COPY.notFoundTitle}
        body={LEARN_COPY.notFoundBody}
        action={
          <Button asChild variant="info" iconRight={ArrowRight}>
            <UiLink href={ROUTES.learn}>{LEARN_COPY.notFoundAction}</UiLink>
          </Button>
        }
      />
      {suggestion ? (
        <p className="text-center text-body-sm text-ink-2">
          {LEARN_COPY.notFoundSuggest}{' '}
          <UiLink href={ROUTES.lesson(suggestion.id)} className="link">
            {richText(suggestion.title)}
          </UiLink>
        </p>
      ) : null}
    </div>
  );
}
