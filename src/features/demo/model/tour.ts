/**
 * The guided tour as a small state machine: four steps, each one a thing to do. It moves on
 * when the person does that thing or presses Next, can be closed at any moment, and once
 * closed stays closed for the session unless it is started again on purpose.
 *
 * Pure: the screen turns clicks, key presses and game events into `TourEvent`s.
 */
export const TOUR_STEPS = ['world', 'log', 'impact', 'coach'] as const;
export type TourStepId = (typeof TOUR_STEPS)[number];

export type TourState =
  /** Never started in this session. */
  | { status: 'idle' }
  | {
      status: 'running';
      step: TourStepId;
      /** The step's own action has been taken; the tour moves on in a moment. */
      did: boolean;
    }
  /** All four steps are behind the visitor; the last card offers what comes next. */
  | { status: 'wrap' }
  /** Closed for the session. `finished` tells a completed tour from a skipped one. */
  | { status: 'closed'; finished: boolean };

export type TourEvent =
  /** The demo opened: begins the tour unless it was already closed in this session. */
  | { type: 'start' }
  /** "Tour" in the banner: always begins again from the first step. */
  | { type: 'restart' }
  | { type: 'next' }
  | { type: 'back' }
  /** The visitor did what a step asks for. Counts only for the step that is showing. */
  | { type: 'did'; step: TourStepId }
  /** Close button, "Skip tour" or Escape. */
  | { type: 'dismiss' }
  /** The demo ended: an unfinished tour starts over next time, a closed one stays closed. */
  | { type: 'leave' };

export const TOUR_INITIAL: TourState = { status: 'idle' };

const first = (): TourState => ({ status: 'running', step: TOUR_STEPS[0], did: false });

export function tourStepNumber(step: TourStepId): number {
  return TOUR_STEPS.indexOf(step) + 1;
}

function after(step: TourStepId): TourState {
  const next = TOUR_STEPS[TOUR_STEPS.indexOf(step) + 1];
  return next ? { status: 'running', step: next, did: false } : { status: 'wrap' };
}

export function tourReducer(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case 'start':
      return state.status === 'idle' ? first() : state;
    case 'restart':
      return first();
    case 'next':
      if (state.status === 'running') return after(state.step);
      if (state.status === 'wrap') return { status: 'closed', finished: true };
      return state;
    case 'back': {
      if (state.status === 'wrap') {
        return { status: 'running', step: TOUR_STEPS[TOUR_STEPS.length - 1] ?? 'coach', did: true };
      }
      if (state.status !== 'running') return state;
      const previous = TOUR_STEPS[TOUR_STEPS.indexOf(state.step) - 1];
      return previous ? { status: 'running', step: previous, did: false } : state;
    }
    case 'did':
      if (state.status !== 'running' || state.step !== event.step || state.did) return state;
      return { ...state, did: true };
    case 'dismiss':
      if (state.status === 'running') return { status: 'closed', finished: false };
      if (state.status === 'wrap') return { status: 'closed', finished: true };
      return state;
    case 'leave':
      return state.status === 'closed' ? state : TOUR_INITIAL;
  }
}

/** True while a hint is on screen. */
export function isTourOpen(state: TourState): boolean {
  return state.status === 'running' || state.status === 'wrap';
}

/** What is kept in session storage; anything unreadable is "never started". */
export function parseTourState(raw: string | null | undefined): TourState {
  if (!raw) return TOUR_INITIAL;
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null) return TOUR_INITIAL;
    switch (data.status) {
      case 'running': {
        const step = TOUR_STEPS.find((id) => id === data.step);
        return step ? { status: 'running', step, did: data.did === true } : TOUR_INITIAL;
      }
      case 'wrap':
        return { status: 'wrap' };
      case 'closed':
        return { status: 'closed', finished: data.finished === true };
      default:
        return TOUR_INITIAL;
    }
  } catch {
    return TOUR_INITIAL;
  }
}
