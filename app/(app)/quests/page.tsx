import type { Metadata } from 'next';
import { QuestsRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Quests' };

export default function Page() {
  return <QuestsRoute />;
}
