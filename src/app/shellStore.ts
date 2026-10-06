import { create } from 'zustand';
import { normalizePath, ROUTES } from './routes';

/**
 * What the shell's own chrome is doing: which overlay is open. Never persisted, never game
 * state. Pages reach it through `@/app/shell`.
 */
export interface ShellState {
  paletteOpen: boolean;
  /** Text the palette opens with. */
  paletteQuery: string;
  coachOpen: boolean;
  /** A question for Moss from outside the drawer. A new `id` means "ask this now". */
  coachAsk: { id: number; text: string } | null;
  /** How many mounted components asked for the navigation to step aside (the break timer). */
  chromeHidden: number;
  /** The level the user has just reached, while its dialog is showing. */
  levelUp: { level: number; title: string } | null;

  setPaletteOpen: (open: boolean, query?: string) => void;
  setPaletteQuery: (query: string) => void;
  setCoachOpen: (open: boolean, prompt?: string | null) => void;
  hideChrome: () => () => void;
  setLevelUp: (levelUp: { level: number; title: string } | null) => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  paletteOpen: false,
  paletteQuery: '',
  coachOpen: false,
  coachAsk: null,
  chromeHidden: 0,
  levelUp: null,

  setPaletteOpen: (open, query) =>
    // A fresh palette starts empty; closing keeps nothing behind.
    set({ paletteOpen: open, paletteQuery: open ? (query ?? '') : '' }),
  setPaletteQuery: (query) => set({ paletteQuery: query }),
  setCoachOpen: (open, prompt) =>
    set((state) => ({
      coachOpen: open,
      coachAsk:
        open && prompt?.trim()
          ? { id: (state.coachAsk?.id ?? 0) + 1, text: prompt.trim() }
          : state.coachAsk,
      paletteOpen: open ? false : state.paletteOpen,
    })),
  hideChrome: () => {
    set((state) => ({ chromeHidden: state.chromeHidden + 1 }));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      set((state) => ({ chromeHidden: Math.max(0, state.chromeHidden - 1) }));
    };
  },
  setLevelUp: (levelUp) => set({ levelUp }),
}));

/**
 * Opens the coach from anywhere, optionally asking a question straight away. On `/coach` the
 * conversation is already the page, so the cursor goes to its composer instead.
 */
export function openCoach(prompt?: string): void {
  if (typeof window !== 'undefined' && normalizePath(window.location.pathname) === ROUTES.coach) {
    document.getElementById('coach-composer')?.focus();
    return;
  }
  useShellStore.getState().setCoachOpen(true, prompt ?? null);
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
