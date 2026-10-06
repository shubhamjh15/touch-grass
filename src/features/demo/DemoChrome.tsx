'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useIsOnboarded } from '@/game';
import { DemoBanner } from './components/DemoBanner';
import { TourLayer } from './components/TourLayer';
import { leaveLink } from './demo';
import { tourSend } from './demoStore';

/**
 * Everything the demo world adds to the app's frame: the banner and the tour. The shell
 * mounts it only while the game is showing a sandbox.
 */
export default function DemoChrome() {
  const router = useRouter();
  const onboarded = useIsOnboarded();

  useEffect(() => {
    // A tab that was reloaded inside the demo picks its tour up where it stood; one that
    // arrived some other way (a demo world imported from a file, say) gets it from the start.
    tourSend({ type: 'start' });
  }, []);

  useEffect(() => {
    // A demo without a planted tree (an import of an unfinished save) is no demo: step out.
    if (!onboarded) router.replace(leaveLink('home'));
  }, [onboarded, router]);

  return (
    <>
      <DemoBanner />
      <TourLayer />
    </>
  );
}
