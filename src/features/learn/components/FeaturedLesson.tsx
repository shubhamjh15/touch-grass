'use client';

import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/cn';
import { Button, Card, Stamp, Tag, UiLink } from '@/ui';
import { LEARN_COPY } from '../copy';
import { lessonLength, lessonSlug, type FeaturedLesson as Featured } from '../model/library';
import { richText } from '../model/richText';
import { TOPIC_BY_ID } from '../model/topics';

/** The id of the quiz card on the lesson page; a resumed quiz links straight to it. */
export const QUIZ_ANCHOR = 'quiz';

/**
 * The one lesson to do next, on the page's single featured card: a first run starts at lesson 1,
 * an abandoned quiz comes back first, then whatever was being read, then the recommendation.
 */
export function FeaturedLesson({ featured }: { featured: Featured }) {
  const titleId = useId();
  const { row, reason } = featured;
  const { lesson } = row;
  const topic = TOPIC_BY_ID[lesson.category];
  const TopicIcon = topic.icon;
  const base = ROUTES.lesson(lesson.id);
  const href = reason === 'resume-quiz' ? `${base}#${QUIZ_ANCHOR}` : base;

  return (
    <Card as="section" featured plate="blue" aria-labelledby={titleId}>
      <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-center @3xl:gap-6">
        <span
          aria-hidden="true"
          className={cn(
            'hidden size-20 shrink-0 -rotate-3 place-items-center rounded-md border-3 border-ink shadow-2 @xl:grid',
            topic.tile,
          )}
        >
          <TopicIcon size={36} strokeWidth={2.25} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Tag hue="blue">{LEARN_COPY.featured[reason]}</Tag>
            <span className="type-slug text-ink-3">
              {lessonSlug(row.number, lesson.readingMinutes)} · {topic.label}
            </span>
          </p>
          <h2 id={titleId} className="mt-2.5 text-h2">
            {lesson.title}
          </h2>
          <p className="mt-2 max-w-[62ch] text-body text-ink-2">{richText(lesson.summary)}</p>
          <p className="mt-3 font-mono text-data text-ink-2">
            {reason === 'resume-quiz'
              ? LEARN_COPY.quizResume(row.quizAnswered)
              : `${lessonLength(lesson)} · ${LEARN_COPY.featuredReward}`}
          </p>
        </div>

        <Button asChild variant="info" size="lg" iconRight={ArrowRight} className="@3xl:shrink-0">
          <UiLink href={href}>{LEARN_COPY.featuredAction[reason]}</UiLink>
        </Button>
      </div>
    </Card>
  );
}

/** Every lesson passed: nothing to feature, so the card says so and stamps it. */
export function ShelfComplete({ total }: { total: number }) {
  const titleId = useId();
  return (
    <Card as="section" featured plate="green" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="type-slug text-ink-3">{LEARN_COPY.allPassedSlug}</p>
          <h2 id={titleId} className="mt-2.5 text-h2">
            {LEARN_COPY.allPassedTitle}
          </h2>
          <p className="mt-2 max-w-[62ch] text-body text-ink-2">{LEARN_COPY.allPassedBody}</p>
        </div>
        <Stamp label={`${total} of ${total}`} hue="green" rotate={-6} className="mr-3" />
      </div>
    </Card>
  );
}
