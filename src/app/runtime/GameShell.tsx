'use client';

import '../boot/connectGame';

import { useEffect } from 'react';
import {
  gameActions,
  useGameClock,
  useGameHydrated,
  useIsOnboarded,
  useTouchGrassTracker,
} from '@/game';
import { installAudioUnlock } from '@/lib/sfx';
import { Toaster } from '@/ui';
import { WorldBridge } from '../bridge/WorldBridge';
import { Feedback } from '../feedback/Feedback';

/** Things that must run exactly once for the whole app, whatever route is showing. */
function GameRuntime() {
  useGameClock();
  useTouchGrassTracker();

  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  useEffect(() => {
    // First launch only: look for data from the old app, so onboarding can offer to bring it along.
    if (hydrated && !onboarded) gameActions.scanLegacy();
  }, [hydrated, onboarded]);

  useEffect(() => installAudioUnlock(), []);

  return null;
}

/**
 * Everything in the outermost shell that needs the game: its clock, the bridge to the 3D world,
 * the feedback for game events (toasts with Undo, sounds, celebrations) and the toast outlet.
 *
 * It is a chunk of its own. App routes ship it with the page; public pages (landing,
 * methodology, privacy, the 404) fetch it after they have painted, so a first-time visitor does
 * not wait for the rules engine and its catalogue before reading a word. Once mounted it stays
 * mounted, like the layout that holds it.
 */
export function GameShell() {
  return (
    <>
      <GameRuntime />
      <WorldBridge />
      <Feedback />
      <Toaster />
    </>
  );
}
