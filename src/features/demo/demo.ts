/**
 * The way into and out of the demo world.
 *
 * `startDemo()` grows the world (once a day per tab), hands it to the game as a sandbox and
 * begins the tour. From that moment the game reads and saves a separate, session-only
 * namespace: the visitor's real save is not read, changed or followed until `exitDemo()`,
 * which forgets the sandbox and brings back exactly what was there, including "nothing
 * planted yet".
 */
import { PARAMS, demoLeaveLink } from '@/app/routes';
import { game, gameStore, getGameState, isOnboarded } from '@/game';
import { tourSend, useDemoStore } from './demoStore';
import { DEMO_DAYS } from './model/demoWorld';
import { growDemoWorld } from './model/grow';

/**
 * The way out. Leaving goes through `/demo`, a route no guard watches, so nothing redirects
 * half-way through the switch back to the real save.
 */
export const LEAVE_PARAM = PARAMS.demoLeave;
export const leaveLink = demoLeaveLink;

export function isDemoOn(): boolean {
  return gameStore.getState().runtime.sandbox;
}

let starting: Promise<boolean> | null = null;
/** Somebody is still waiting for the demo. Growing takes a moment; they may have walked off. */
let wanted = false;

async function begin(): Promise<boolean> {
  if (!isDemoOn()) {
    useDemoStore.setState({ phase: 'growing', day: 0, days: DEMO_DAYS });
    try {
      const state = await growDemoWorld(Date.now(), ({ day, days }) => {
        if (useDemoStore.getState().day !== day) useDemoStore.setState({ day, days });
      });
      if (!wanted) {
        // The world stays grown for the next time; the app is left as it is.
        useDemoStore.setState({ phase: 'idle' });
        return false;
      }
      game.enterSandbox(state);
    } catch {
      useDemoStore.setState({ phase: 'failed' });
      return false;
    }
  }
  useDemoStore.setState({ phase: 'idle', day: DEMO_DAYS, days: DEMO_DAYS });
  tourSend({ type: 'start' });
  return true;
}

/**
 * Puts the app into the demo world. Resolves `true` once the sandbox is showing (at once
 * when it already is) and `false` when the world could not be grown; calls made while one
 * is under way share its result.
 */
export function startDemo(): Promise<boolean> {
  wanted = true;
  starting ??= begin().finally(() => {
    starting = null;
  });
  return starting;
}

/**
 * Takes back a `startDemo()` that has not finished: the page that asked for it has gone, and
 * a sandbox must never switch on under someone who is looking at something else by then.
 */
export function cancelDemoStart(): void {
  wanted = false;
}

/**
 * Leaves the demo world. Returns whether the visitor has a tree of their own, so the
 * caller knows where to send them: their Today, or the way to plant one.
 */
export function exitDemo(): { hasOwnTree: boolean } {
  game.leaveSandbox();
  tourSend({ type: 'leave' });
  return { hasOwnTree: isOnboarded(getGameState()) };
}
