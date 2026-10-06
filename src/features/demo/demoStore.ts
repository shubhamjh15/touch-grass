/**
 * What the demo is doing right now: growing its world, and where the tour stands. The tour
 * is remembered for the tab's session (so a closed tour stays closed across reloads and a
 * second visit to the demo); nothing here is game state and nothing is kept longer.
 */
import { create } from 'zustand';
import {
  TOUR_INITIAL,
  isTourOpen,
  parseTourState,
  tourReducer,
  type TourEvent,
  type TourState,
} from './model/tour';

/** Session-storage key of the tour's state. */
export const DEMO_TOUR_KEY = 'touchgrass:demo-tour';

export type DemoPhase = 'idle' | 'growing' | 'failed';

export interface DemoState {
  phase: DemoPhase;
  /** The day of the history being played, while growing. */
  day: number;
  days: number;
  tour: TourState;
  /** Counts explicit moves (Next, Back, Tour): the hint takes focus when it changes. */
  focusTick: number;
}

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readTour(): TourState {
  try {
    return parseTourState(session()?.getItem(DEMO_TOUR_KEY));
  } catch {
    return TOUR_INITIAL;
  }
}

function writeTour(tour: TourState): void {
  try {
    if (tour.status === 'idle') session()?.removeItem(DEMO_TOUR_KEY);
    else session()?.setItem(DEMO_TOUR_KEY, JSON.stringify(tour));
  } catch {
    // Without session storage the tour simply starts again after a reload.
  }
}

export const useDemoStore = create<DemoState>()(() => ({
  phase: 'idle',
  day: 0,
  days: 0,
  tour: readTour(),
  focusTick: 0,
}));

/** Moves that the visitor made on purpose with a control of the tour itself. */
const TAKES_FOCUS: readonly TourEvent['type'][] = ['restart', 'next', 'back'];

/** Sends one event to the tour and remembers where it now stands. */
export function tourSend(event: TourEvent): void {
  const { tour, focusTick } = useDemoStore.getState();
  const next = tourReducer(tour, event);
  const explicit = TAKES_FOCUS.includes(event.type);
  if (next === tour && !explicit) return;
  writeTour(next);
  useDemoStore.setState({ tour: next, focusTick: explicit ? focusTick + 1 : focusTick });
}

/**
 * "Tour" in the banner: brings the hint that is showing back into view and gives it focus,
 * or begins the tour again once it has been closed.
 */
export function tourShow(): void {
  const { tour, focusTick } = useDemoStore.getState();
  if (isTourOpen(tour)) useDemoStore.setState({ focusTick: focusTick + 1 });
  else tourSend({ type: 'restart' });
}

/** For tests: back to a tab that has never seen the demo. */
export function resetDemoStore(): void {
  writeTour(TOUR_INITIAL);
  useDemoStore.setState({ phase: 'idle', day: 0, days: 0, tour: TOUR_INITIAL, focusTick: 0 });
}
