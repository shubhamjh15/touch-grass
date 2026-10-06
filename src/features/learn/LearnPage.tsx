'use client';

import { ArrowRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { MYTHS } from '@/data/content';
import { useGameEvent, useLearn } from '@/game';
import { Button, EmptyState, SectionHeading, TextLink } from '@/ui';
import { DailyFact } from './components/DailyFact';
import { FeaturedLesson, ShelfComplete } from './components/FeaturedLesson';
import { LibraryFrame } from './components/LearnFrame';
import { LessonCard } from './components/LessonCard';
import { LibraryHeader } from './components/LibraryHeader';
import { MythDeck } from './components/MythDeck';
import { TopicFilter } from './components/TopicFilter';
import { LEARN_COPY } from './copy';
import {
  buildLibrary,
  featuredLesson,
  filterLessons,
  librarySummary,
  parseTopic,
  topicCounts,
  type TopicFilter as Topic,
} from './model/library';
import { readQuizDrafts } from './model/quizDrafts';
import { TOPIC_BY_ID } from './model/topics';

/** The URL parameter that remembers the topic filter, so Back and a reload keep it. */
const TOPIC_PARAM = 'topic';

/**
 * `/learn`: the shelf. Ten lessons with their state, the one to do next, today's fact and the
 * ten myth-buster cards. Everything is bundled, so there is no loading and no empty state.
 */
export default function LearnPage() {
  const board = useLearn();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topic = parseTopic(params.get(TOPIC_PARAM));

  // Unfinished quizzes live beside the store, on the device. A reset clears them with everything else.
  const [drafts, setDrafts] = useState(readQuizDrafts);
  useGameEvent('state-reset', () => setDrafts({}));
  useEffect(() => {
    // Another tab may have answered a question meanwhile.
    const refresh = () => {
      if (document.visibilityState === 'visible') setDrafts(readQuizDrafts());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const rows = useMemo(() => buildLibrary(board, drafts), [board, drafts]);
  const summary = librarySummary(rows);
  const counts = topicCounts(rows);
  const featured = featuredLesson(rows, board.recommended);
  const shown = filterLessons(rows, topic);

  const setTopic = (next: Topic) => {
    const query = new URLSearchParams(params.toString());
    if (next === 'all') query.delete(TOPIC_PARAM);
    else query.set(TOPIC_PARAM, next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  return (
    <LibraryFrame>
      <LibraryHeader
        summary={summary}
        mythsChecked={board.mythsFlipped.length}
        mythsTotal={MYTHS.length}
      />

      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:gap-6">
        {featured ? (
          <FeaturedLesson featured={featured} />
        ) : (
          <ShelfComplete total={summary.total} />
        )}
        <DailyFact />
      </div>

      <section aria-label={LEARN_COPY.lessonsHeading}>
        <SectionHeading
          className="mt-0"
          title={LEARN_COPY.lessonsHeading}
          meta={LEARN_COPY.progressText(summary.passed, summary.total)}
        />
        <TopicFilter value={topic} counts={counts} onChange={setTopic} />
        <p role="status" className="sr-only">
          {LEARN_COPY.filterAnnouncement(
            shown.length,
            topic === 'all' ? null : TOPIC_BY_ID[topic].label,
          )}
        </p>

        {shown.length > 0 ? (
          <ul className="mt-4 grid gap-3 md:gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @5xl:gap-5">
            {shown.map((row) => (
              <li key={row.lesson.id} className="min-w-0">
                <LessonCard
                  row={row}
                  recommended={
                    row.lesson.id === board.recommended && row.lesson.id !== featured?.row.lesson.id
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-4"
            slug={LEARN_COPY.filterEmptySlug}
            title={LEARN_COPY.filterEmptyTitle}
            action={
              <Button variant="neutral" onClick={() => setTopic('all')}>
                {LEARN_COPY.filterEmptyAction}
              </Button>
            }
          />
        )}
      </section>

      <MythDeck flippedEver={board.mythsFlipped} />

      <p className="text-body-sm text-ink-2">
        {LEARN_COPY.sourcesNote}{' '}
        <TextLink href={ROUTES.methodology} className="inline-flex items-center gap-1">
          {LEARN_COPY.sourcesLink}
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </TextLink>
      </p>
    </LibraryFrame>
  );
}
