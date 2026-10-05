import type { Metadata } from 'next';
import { TodayRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Today' };

export default function Page() {
  return <TodayRoute />;
}
