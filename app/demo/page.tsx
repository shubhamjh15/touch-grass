import type { Metadata } from 'next';
import { DemoRoute } from '@/app/routes.client';

export const metadata: Metadata = {
  title: 'Demo world',
  description:
    'Look around a grown tree: two hundred days of real actions, replayed through the real rules. Nothing is saved.',
};

export default function Page() {
  return <DemoRoute />;
}
