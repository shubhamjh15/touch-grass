import type { Metadata } from 'next';
import { ImpactRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Impact' };

export default function Page() {
  return <ImpactRoute />;
}
