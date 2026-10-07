import type { Metadata } from 'next';
import LandingPage from '@/features/landing/LandingPage';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Page() {
  return <LandingPage />;
}
