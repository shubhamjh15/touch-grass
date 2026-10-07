import type { Metadata } from 'next';
import { NotFoundPage } from '@/app/layouts/RootLayout';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return <NotFoundPage />;
}
