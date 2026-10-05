import type { Metadata } from 'next';
import { LessonRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Lesson' };

export default function Page() {
  return <LessonRoute />;
}
