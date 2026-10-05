import type { Metadata } from 'next';
import { ProfileRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Me' };

export default function Page() {
  return <ProfileRoute />;
}
