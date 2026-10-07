'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/ui';

// Export and delete need the game (the store, the rules, the catalogue). The privacy page is a
// reading page that anyone may open first, so those arrive after it has painted; the placeholder
// is the one the section already showed while the saved state was being read.
const YourData = dynamic(() => import('./YourData').then((module) => module.YourData), {
  ssr: false,
  loading: () => <Skeleton shape="block" className="h-44" aria-label="Checking this device" />,
});

/** The privacy page's "Your data" controls, fetched once the page is on screen. */
export function YourDataSlot() {
  return <YourData />;
}
