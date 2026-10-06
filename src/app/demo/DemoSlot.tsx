'use client';

import dynamic from 'next/dynamic';
import { useIsSandbox } from '@/game';

/** Holds the banner's place on a phone while its chunk loads, so the page does not jump. */
function BannerPlaceholder() {
  return <div aria-hidden="true" className="h-[calc(48px+var(--safe-t))] bg-ink lg:hidden" />;
}

// The banner and the tour belong to the demo feature: they load only when a demo is showing.
const DemoChrome = dynamic(() => import('@/features/demo/DemoChrome'), {
  ssr: false,
  loading: BannerPlaceholder,
});

/**
 * Where the demo world announces itself on every app page: a banner that says nothing is
 * saved and offers the way out, plus the guided tour. Empty unless the game is showing a
 * sandbox, so someone using their own tree never loads any of it.
 */
export function DemoSlot() {
  const sandbox = useIsSandbox();
  return sandbox ? <DemoChrome /> : null;
}
