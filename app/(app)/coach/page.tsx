import type { Metadata } from 'next';
import { CoachRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Coach' };

export default function Page() {
  return <CoachRoute />;
}
