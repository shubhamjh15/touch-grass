import type { Metadata } from 'next';
import { LogRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Log' };

export default function Page() {
  return <LogRoute />;
}
