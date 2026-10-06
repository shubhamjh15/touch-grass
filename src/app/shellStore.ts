import { create } from 'zustand';

/**
 * What the shell's own chrome is doing: which overlay is open, what the HUD is flashing.
 * Never persisted, never game state. Pages reach it through `@/app/shell`.
 */
export interface CoachAsk {
  id: number;
  text: string;
}

let askCounter = 0;

export interface ShellState {
  paletteOpen: boolean;
  /** Text the palette opens with (e.g. "bike 5" from a shortcut). */
  paletteQuery: string;
  coachOpen: boolean;
  /** A question for the coach to answer when it opens; a new `id` is a new question. */
  coachAsk: CoachAsk | null;
  moreOpen: boolean;
  /** The mobile HUD sheet behind the tree chip. */
  hudOpen: boolean;
  shortcutsOpen: boolean;
  /** How many mounted components asked for the navigation to step aside (break timer, ceremonies). */
  chromeHidden: number;
  /** XP of the action that just happened: the XP bar draws it yellow for a moment. */
  xpJustEarned: number;
  /** A streak milestone being celebrated beside the flame. */
  streakFlash: number | null;
  /** The HUD's tree chip or tree button wiggles (a reward arrived while the world is docked). */
  treeNudge: number;

  setPaletteOpen: (open: boolean, query?: string) => void;
  setPaletteQuery: (query: string) => void;
  setCoachOpen: (open: boolean, ask?: string | null) => void;
  setMoreOpen: (open: boolean) => void;
  setHudOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  hideChrome: () => () => void;
  flashXp: (amount: number) => void;
  flashStreak: (days: number | null) => void;
  nudgeTree: () => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  paletteOpen: false,
  paletteQuery: '',
  coachOpen: false,
  coachAsk: null,
  moreOpen: false,
  hudOpen: false,
  shortcutsOpen: false,
  chromeHidden: 0,
  xpJustEarned: 0,
  streakFlash: null,
  treeNudge: 0,

  setPaletteOpen: (open, query) =>
    set((state) => ({
      paletteOpen: open,
      // A fresh palette starts empty; closing keeps nothing behind.
      paletteQuery: open ? (query ?? '') : '',
      moreOpen: open ? false : state.moreOpen,
    })),
  setPaletteQuery: (query) => set({ paletteQuery: query }),
  setCoachOpen: (open, question) =>
    set((state) => ({
      coachOpen: open,
      coachAsk: open ? (question ? { id: ++askCounter, text: question } : state.coachAsk) : null,
      moreOpen: open ? false : state.moreOpen,
      paletteOpen: open ? false : state.paletteOpen,
    })),
  setMoreOpen: (open) => set({ moreOpen: open }),
  setHudOpen: (open) => set({ hudOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  hideChrome: () => {
    set((state) => ({ chromeHidden: state.chromeHidden + 1 }));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      set((state) => ({ chromeHidden: Math.max(0, state.chromeHidden - 1) }));
    };
  },
  flashXp: (amount) => set({ xpJustEarned: amount }),
  flashStreak: (days) => set({ streakFlash: days }),
  nudgeTree: () => set((state) => ({ treeNudge: state.treeNudge + 1 })),
}));

/** Opens the coach drawer from anywhere, optionally with a question for it to answer. */
export function openCoach(question?: string): void {
  useShellStore.getState().setCoachOpen(true, question ?? null);
}

export function closeCoach(): void {
  useShellStore.getState().setCoachOpen(false);
}

/** Opens the command palette, optionally with text already typed. */
export function openPalette(query?: string): void {
  useShellStore.getState().setPaletteOpen(true, query);
}

export function closePalette(): void {
  useShellStore.getState().setPaletteOpen(false);
}
