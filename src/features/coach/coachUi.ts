/**
 * What the coach surface remembers between openings: the unsent draft, where the reader
 * left the list, and this session's live requests. In memory only, so the drawer can
 * unmount and come back exactly as it was, and nothing new is written to the device.
 */
import { create } from 'zustand';
import { getAiStatus, resetAiStatus, streamChat, useCoachStore, type CoachClient } from '@/ai';
import { gameEvents } from '@/game';
import { LIVE_BUDGET, withLiveBudget } from './liveBudget';

export type PanelVariant = 'drawer' | 'page';

interface CoachUiState {
  draft: string;
  /** Scroll offset the reader left each surface at; `null` means "follow the latest". */
  scroll: Record<PanelVariant, number | null>;
  moreIdeas: boolean;
  /** Moments of this session's live requests (the chat store remembers earlier ones). */
  liveSends: number[];
  /** Chips already used, as `<messageId>|<chipKey>` → the log they made. */
  stuck: Record<string, string>;
  setDraft(draft: string): void;
  setScroll(variant: PanelVariant, offset: number | null): void;
  setMoreIdeas(open: boolean): void;
  recordLiveSend(moment: number): void;
  markStuck(key: string, logId: string): void;
  unmarkStuck(logId: string): void;
  reset(): void;
}

const initial = {
  draft: '',
  scroll: { drawer: null, page: null },
  moreIdeas: false,
  liveSends: [],
  stuck: {},
} satisfies Partial<CoachUiState>;

export const useCoachUi = create<CoachUiState>()((set) => ({
  ...initial,
  setDraft: (draft) => set({ draft }),
  setScroll: (variant, offset) =>
    set((state) => ({ scroll: { ...state.scroll, [variant]: offset } })),
  setMoreIdeas: (moreIdeas) => set({ moreIdeas }),
  recordLiveSend: (moment) =>
    set((state) => ({
      liveSends: [...state.liveSends, moment].filter(
        (sent) => sent > moment - LIVE_BUDGET.windowMs,
      ),
    })),
  markStuck: (key, logId) => set((state) => ({ stuck: { ...state.stuck, [key]: logId } })),
  unmarkStuck: (logId) =>
    set((state) => ({
      stuck: Object.fromEntries(Object.entries(state.stuck).filter(([, id]) => id !== logId)),
    })),
  reset: () => set({ ...initial, scroll: { drawer: null, page: null }, liveSends: [], stuck: {} }),
}));

/**
 * Live requests this device knows about: the ones made in this session, or the live
 * answers still in the saved chat, whichever list is longer (they describe the same
 * requests, so they are never added together).
 */
function knownLiveSends(): readonly number[] {
  const session = useCoachUi.getState().liveSends;
  const saved = useCoachStore
    .getState()
    .messages.filter((message) => message.role === 'assistant' && message.source === 'live')
    .map((message) => message.createdAt);
  return saved.length > session.length ? saved : session;
}

/** The network client the coach uses in the app: the real one, behind the device's hourly budget. */
export const budgetedClient: CoachClient = withLiveBudget(
  { getAiStatus, streamChat, resetStatus: resetAiStatus },
  {
    now: () => Date.now(),
    sends: knownLiveSends,
    record: (moment) => useCoachUi.getState().recordLiveSend(moment),
  },
);

// "Reset everything" on the profile page must also empty a chat that is still in memory,
// otherwise the next message would write the old conversation back to the device.
gameEvents.on('state-reset', () => {
  useCoachStore.getState().clear();
  useCoachUi.getState().reset();
});
