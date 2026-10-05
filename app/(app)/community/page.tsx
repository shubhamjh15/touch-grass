import type { Metadata } from 'next';
import { CommunityRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Community' };

export default function Page() {
  return <CommunityRoute />;
}
