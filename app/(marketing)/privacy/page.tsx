import type { Metadata } from 'next';
import PrivacyPage from '@/features/legal/PrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy',
  alternates: { canonical: '/privacy' },
  description:
    'What Touch Grass stores on your device, what leaves it, and how to export or delete it.',
};

export default function Page() {
  return <PrivacyPage />;
}
