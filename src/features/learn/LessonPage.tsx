'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { usePageTitle } from '@/app/shell';
import { LESSON_BY_ID, type Lesson } from '@/data/content';
import { useLearn, useProfile } from '@/game';
import { QUIZ_ANCHOR } from './components/FeaturedLesson';
import { LessonArticle } from './components/LessonArticle';
import { DoNext, LessonHeader, LessonNotFound, LessonPager } from './components/LessonParts';
import { Quiz } from './components/Quiz';
import { ReadingProgress } from './components/ReadingProgress';
import { LEARN_COPY } from './copy';
import {
  buildLibrary,
  featuredLesson,
  lessonNeighbours,
  nextUnpassed,
  type LessonRow,
} from './model/library';
import { useLessonRead, useReadingProgress } from './model/reading';

/** The slug in the URL, decoded; an undecodable one simply matches no lesson. */
function slugFrom(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function Reader({ lesson, rows, row }: { lesson: Lesson; rows: LessonRow[]; row: LessonRow }) {
  const profile = useProfile();
  const article = useRef<HTMLElement>(null);
  const percent = useReadingProgress(article);
  useLessonRead(lesson.id, article, row.status !== 'new');

  useEffect(() => {
    // A resumed quiz links here with "#quiz"; the page arrives after the browser looked for it.
    if (window.location.hash !== `#${QUIZ_ANCHOR}`) return;
    document.getElementById(QUIZ_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, []);

  const neighbours = lessonNeighbours(lesson.id);
  const next = nextUnpassed(rows, lesson.id);

  return (
    <div id="lesson-top" className="flex scroll-mt-32 flex-col">
      <ReadingProgress percent={percent} />
      <LessonHeader row={row} />
      <div className="flex flex-col gap-6 md:gap-8">
        <LessonArticle lesson={lesson} ref={article} />
        <DoNext lesson={lesson} />
        <Quiz
          lesson={lesson}
          status={row.status}
          bestScore={row.bestScore}
          attempts={row.attempts}
          userSeed={profile.userSeed}
          next={next?.lesson ?? null}
        />
        {neighbours ? <LessonPager neighbours={neighbours} /> : null}
      </div>
    </div>
  );
}

/**
 * `/learn/:lessonId`: the reader. One calm column: reading progress, the lesson on a white card
 * with its sources, two things to do next and the three-question quiz. A slug that matches no
 * lesson says so in the page and points back to the shelf.
 */
export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const lesson = LESSON_BY_ID.get(slugFrom(params?.lessonId)) ?? null;
  const board = useLearn();
  const rows = useMemo(() => buildLibrary(board), [board]);
  const row = lesson ? rows.find((candidate) => candidate.lesson.id === lesson.id) : undefined;

  usePageTitle(lesson ? lesson.title : LEARN_COPY.notFoundTitle.replace(/\.$/, ''));

  if (!lesson || !row) {
    const suggestion = featuredLesson(rows, board.recommended)?.row.lesson ?? null;
    return <LessonNotFound suggestion={suggestion} />;
  }

  // Keyed by lesson: moving to the next one starts its reader and its quiz from scratch.
  return <Reader key={lesson.id} lesson={lesson} rows={rows} row={row} />;
}
