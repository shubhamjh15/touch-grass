/**
 * Growing the demo world without freezing the page. Playing two hundred days through the
 * rules takes a second or two, so the work is cut into slices of a few milliseconds with
 * the browser given a turn in between. The finished state is kept for the day: in memory,
 * and in the tab's session storage so a reload does not grow it again.
 */
import { validateState, type GameState } from '@/game';
import { dayKey, type DayKey } from '@/lib/dates';
import { DEMO_DAYS, DEMO_SEED, playDemoWorld, type DemoProgress } from './demoWorld';

/** Session-storage key of the grown world, as it was before anyone touched it. */
export const DEMO_CACHE_KEY = 'touchgrass:demo-world';
const CACHE_VERSION = 1;
/** Work done before the browser gets a turn: short enough to keep a progress bar moving. */
const SLICE_MS = 10;

export type GrowListener = (progress: DemoProgress) => void;

interface Cached {
  day: DayKey;
  state: GameState;
}

let memory: Cached | null = null;
let growing: { day: DayKey; promise: Promise<GameState>; listeners: Set<GrowListener> } | null =
  null;

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A world grown earlier today, if this tab still has one that passes the game's own validation. */
function readCache(day: DayKey): GameState | null {
  if (memory?.day === day) return memory.state;
  try {
    const raw = session()?.getItem(DEMO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v?: unknown;
      seed?: unknown;
      day?: unknown;
      state?: unknown;
    };
    if (parsed.v !== CACHE_VERSION || parsed.seed !== DEMO_SEED || parsed.day !== day) return null;
    if (!validateState(parsed.state).ok) return null;
    memory = { day, state: parsed.state as GameState };
    return memory.state;
  } catch {
    return null;
  }
}

function writeCache(day: DayKey, state: GameState): void {
  memory = { day, state };
  try {
    session()?.setItem(
      DEMO_CACHE_KEY,
      JSON.stringify({ v: CACHE_VERSION, seed: DEMO_SEED, day, state }),
    );
  } catch {
    // A full or blocked session storage only means the next reload grows the world again.
  }
}

/**
 * Lets the browser handle input and paint before the next slice. A message is a task of its
 * own without the four-millisecond floor that nested timers have, so the pauses cost nothing.
 */
function nextTurn(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

async function grow(now: number, listeners: Set<GrowListener>): Promise<GameState> {
  const play = playDemoWorld(now);
  for (;;) {
    const deadline = performance.now() + SLICE_MS;
    let latest: DemoProgress | null = null;
    while (performance.now() < deadline) {
      const step = play.next();
      if (step.done) return step.value;
      latest = step.value;
    }
    if (latest) for (const listener of listeners) listener(latest);
    await nextTurn();
  }
}

/**
 * The demo world for the day of `now`. Grown once: later calls on the same day get the
 * same state (or join the growth already under way) and report progress to `onProgress`.
 */
export function growDemoWorld(now: number, onProgress?: GrowListener): Promise<GameState> {
  const day = dayKey(now);
  const cached = readCache(day);
  if (cached) {
    onProgress?.({ day: DEMO_DAYS, days: DEMO_DAYS });
    return Promise.resolve(cached);
  }
  if (growing?.day !== day) {
    const listeners = new Set<GrowListener>();
    const promise = grow(now, listeners).then(
      (state) => {
        writeCache(day, state);
        growing = null;
        return state;
      },
      (error: unknown) => {
        growing = null;
        throw error;
      },
    );
    growing = { day, promise, listeners };
  }
  if (onProgress) growing.listeners.add(onProgress);
  return growing.promise;
}

/** Forgets the grown world (tests, and a session storage someone else filled). */
export function forgetDemoWorld(): void {
  memory = null;
  growing = null;
  try {
    session()?.removeItem(DEMO_CACHE_KEY);
  } catch {
    // Nothing stored, nothing to forget.
  }
}
