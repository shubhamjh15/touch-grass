/**
 * Every word of the demo world's own chrome: the door, the banner and the tour. Voice as in
 * the bible, section 9: short, direct, honest about what is an estimate and what is a demo.
 */
import { DEMO_DAYS } from './model/demoWorld';
import type { TourStepId } from './model/tour';

export const COPY = {
  entry: {
    slug: 'Demo world',
    title: 'Growing a demo world',
    lead: `Replaying ${DEMO_DAYS} days through the real rules, so every number in it was computed, not typed in.`,
    day: (day: number, days: number) => `Day ${day} of ${days}`,
    progressLabel: 'Days replayed',
    promise: 'Nothing you do in there is saved. Your own data is not touched.',
    leaving: 'Putting your own world back',
    failedTitle: 'The demo world would not grow.',
    failedBody: 'Nothing was changed. Try once more, or start a tree of your own.',
    retry: 'Try again',
    home: 'Back home',
  },
  banner: {
    region: 'Demo world',
    label: 'Demo world',
    note: 'Nothing is saved',
    tour: 'Tour',
    tourResume: 'Show the tour step',
    tourRestart: 'Start the tour again',
    own: 'Start my own',
    exit: 'Exit',
    exitLabel: 'Exit the demo world',
  },
  tour: {
    step: (number: number, total: number) => `${number} of ${total}`,
    stepSpoken: (number: number, total: number) => `Tour, step ${number} of ${total}`,
    next: 'Next',
    back: 'Back',
    skip: 'Skip tour',
    close: 'Close the tour',
    wrapTitle: 'That is the whole loop.',
    wrapBody:
      'Do something real, stick it on, watch the tree answer, check the honest numbers. This one is a demo. Yours starts as a seed.',
    wrapStay: 'Keep looking',
  },
} as const;

export interface TourCopy {
  title: string;
  body: string;
  /** The same thing in one breath, for the strip a phone shows. */
  short: string;
  /** Shown once the visitor has done what the step asks, where that changes what to say. */
  done?: string;
}

/**
 * The four moments. `here` is what a step says on its own page; `away` is what it says
 * anywhere else, where the ring is on the way there.
 */
export const TOUR_COPY: Record<TourStepId, { here: TourCopy; away?: TourCopy }> = {
  world: {
    here: {
      title: 'This world is alive',
      body: 'Drag to look around. Tap the tree, the pond, anything on the island.',
      short: 'Drag to look around. Tap anything on the island.',
      done: 'That is it. Every prop out there was earned by a real action.',
    },
    away: {
      title: 'Start in the world',
      body: 'Open Today. The island there turns, and everything on it answers a tap.',
      short: 'Open Today: the island turns and answers a tap.',
      done: 'That is it. Every prop out there was earned by a real action.',
    },
  },
  log: {
    here: {
      title: 'Log one real thing',
      body: 'Say what you did in your own words, or tap a sticker. One more closes today’s ring.',
      short: 'Say what you did, or tap a sticker.',
      done: 'Stuck. The estimate, the XP and the new leaves all came from the same rules.',
    },
    away: {
      title: 'Log one real thing',
      body: 'Stick an action on. One more closes today’s ring, and the tree answers.',
      short: 'Stick an action on and watch the tree answer.',
      done: 'Stuck. The estimate, the XP and the new leaves all came from the same rules.',
    },
  },
  impact: {
    here: {
      title: 'Honest numbers',
      body: 'Every figure is an estimate with its source one tap away. The second tab holds the planet’s own numbers, from NASA, NOAA and the World Bank.',
      short: 'Estimates with sources, next to the planet’s own numbers.',
    },
    away: {
      title: 'See the honest numbers',
      body: 'Open Impact: what this tree’s log adds up to, next to the planet’s own numbers.',
      short: 'Open Impact for the honest numbers.',
    },
  },
  coach: {
    here: {
      title: 'Ask in your own words',
      body: 'Moss knows this tree’s log. Ask what to do next, or why a number is what it is.',
      short: 'Ask Moss what to do next, in your own words.',
      done: 'Moss answers from this tree’s own log, with or without an AI key.',
    },
  },
};
