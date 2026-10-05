import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorldLabRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'World lab', robots: { index: false } };

/** Development workbench. It does not exist in production builds. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <WorldLabRoute />;
}
