'use client';

import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/cn';
import { Card, Stamp, Tag } from '@/ui';
import { LEARN_COPY } from '../copy';
import { lessonLength, lessonSlug, statusText, type LessonRow } from '../model/library';
import { richText } from '../model/richText';
import { TOPIC_BY_ID } from '../model/topics';

/** The printed state in a lesson card's corner: a tag while it is open, a stamp once it is passed. */
function LessonState({ row }: { row: LessonRow }) {
  if (row.status === 'passed') {
    return (
      <Stamp
        label={LEARN_COPY.statePassed(row.bestScore)}
        hue="green"
        rotate={-4}
        className="mt-0.5 mr-1"
      />
    );
  }
  if (row.quizAnswered > 0) {
    return (
      <Tag hue="yellow" aria-hidden="true">
        {LEARN_COPY.stateQuiz(row.quizAnswered)}
      </Tag>
    );
  }
  return (
    <Tag hue={row.status === 'read' ? 'paper' : 'white'} aria-hidden="true">
      {row.status === 'read' ? LEARN_COPY.stateRead : LEARN_COPY.stateNew}
    </Tag>
  );
}

/**
 * One lesson on the shelf. The whole card is the link; its name is the title and its description
 * carries the number, the length, the topic and the state, so the state is never colour alone.
 */
export function LessonCard({ row, recommended }: { row: LessonRow; recommended: boolean }) {
  const titleId = useId();
  const aboutId = useId();
  const { lesson } = row;
  const topic = TOPIC_BY_ID[lesson.category];
  const TopicIcon = topic.icon;

  return (
    <Card
      href={ROUTES.lesson(lesson.id)}
      aria-labelledby={titleId}
      aria-describedby={aboutId}
      className="flex h-full flex-col"
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-sm border-2 border-ink',
            topic.tile,
          )}
        >
          <TopicIcon size={20} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1 pt-1">
          <span className="block type-slug leading-[1.4] text-ink-3">
            {lessonSlug(row.number, lesson.readingMinutes)}
          </span>
        </span>
        <LessonState row={row} />
      </span>

      <h3 id={titleId} className="mt-3 text-h4 lg:text-h3">
        {lesson.title}
      </h3>
      <p className="mt-1.5 text-body-sm text-ink-2">{richText(lesson.summary)}</p>

      <span className="mt-auto flex items-center gap-2 pt-4">
        <Tag className={topic.tag}>{topic.label}</Tag>
        {recommended ? <Tag hue="blue">{LEARN_COPY.recommendedTag}</Tag> : null}
        <ArrowRight
          size={20}
          strokeWidth={2.25}
          aria-hidden="true"
          className="ml-auto shrink-0 transition-transform duration-(--dur-fast) ease-out fine:group-hover/card:translate-x-1"
        />
      </span>

      <span id={aboutId} className="sr-only">
        {`Lesson ${row.number}. ${lessonLength(lesson)}. ${topic.label}. ${statusText(row)}.${recommended ? ' Recommended for you.' : ''}`}
      </span>
    </Card>
  );
}
