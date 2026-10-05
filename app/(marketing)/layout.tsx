import type { ReactNode } from 'react';
import { MarketingLayout } from '@/app/layouts/MarketingLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
