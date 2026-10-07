import { create } from 'zustand';
import type { Celebration } from './eventFeedback';

/** Longest a queue may get: a huge import must not turn into a minute of overlays. */
const MAX_QUEUE = 4;

interface CelebrationState {
  /** One hero motion at a time (bible 7.1): the first entry is showing, the rest wait. */
  queue: Celebration[];
  enqueue: (celebrations: readonly Celebration[]) => void;
  /** The current celebration has finished or was dismissed. */
  advance: () => void;
  /** An undo took XP back: a level the user no longer holds is not celebrated. */
  dropLevelsAbove: (level: number) => void;
  clear: () => void;
}

export const useCelebrationStore = create<CelebrationState>()((set) => ({
  queue: [],
  enqueue: (celebrations) =>
    set((state) => ({ queue: [...state.queue, ...celebrations].slice(0, MAX_QUEUE) })),
  advance: () => set((state) => ({ queue: state.queue.slice(1) })),
  dropLevelsAbove: (level) =>
    set((state) => {
      const queue = state.queue.filter(
        (entry) => entry.kind !== 'level-up' || entry.level <= level,
      );
      return queue.length === state.queue.length ? state : { queue };
    }),
  clear: () => set({ queue: [] }),
}));
