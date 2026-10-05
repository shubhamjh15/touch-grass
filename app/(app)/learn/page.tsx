import type { Metadata } from 'next';
import { LearnRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Learn' };

export default function Page() {
  return <LearnRoute />;
}
