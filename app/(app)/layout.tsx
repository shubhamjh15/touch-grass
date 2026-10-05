import type { ReactNode } from 'react';
import { AppLayout } from '@/app/layouts/AppLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
