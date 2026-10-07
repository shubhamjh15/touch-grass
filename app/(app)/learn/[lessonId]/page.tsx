import type { Metadata } from 'next';
import { LessonRoute } from '@/app/routes.client';
import { LESSON_IDS } from '@/data/lessons';

export const metadata: Metadata = { title: 'Lesson' };

/** Every lesson is built ahead of time, so each one opens offline from the stored pages. */
export function generateStaticParams() {
  return LESSON_IDS.map((lessonId) => ({ lessonId }));
}

export default function Page() {
  return <LessonRoute />;
}
