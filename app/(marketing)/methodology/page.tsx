import type { Metadata } from 'next';
import MethodologyPage from '@/features/legal/MethodologyPage';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How Touch Grass estimates the CO2e each action avoids, with ranges and sources.',
};

export default function Page() {
  return <MethodologyPage />;
}
