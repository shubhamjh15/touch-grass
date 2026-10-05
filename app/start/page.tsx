import type { Metadata } from 'next';
import { OnboardingRoute } from '@/app/routes.client';

export const metadata: Metadata = { title: 'Plant your tree' };

export default function Page() {
  return <OnboardingRoute />;
}
