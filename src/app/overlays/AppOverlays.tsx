'use client';

// Loaded for its effect: keeps the coach's chat inside a sandbox while the demo world is on.
import '../bridge/coachSandbox';
import { CoachDrawer } from '../coach/CoachDrawer';
import { Shortcuts } from '../palette/Shortcuts';

/**
 * Everything that can open over any app route: the command palette with its shortcuts and the
 * coach drawer. Only the app shell mounts it, so a visitor without a tree gets none of it.
 */
export function AppOverlays() {
  return (
    <>
      <Shortcuts />
      <CoachDrawer />
    </>
  );
}
