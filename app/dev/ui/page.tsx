import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UiKitRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'UI kit', robots: { index: false } };

/** Development workbench. It does not exist in production builds. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiKitRoute />;
}
