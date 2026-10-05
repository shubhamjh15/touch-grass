/**
 * The coach conversation: persisted on this device only (zustand persist,
 * versioned, capped), plus a few transient fields that are never saved: whether
 * an answer is streaming, what the server reported, and the one-time notice
 * shown when the live coach is unavailable.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { AiErrorCode, ChatRole, ClientAiStatus } from './contract';

export type MessageStatus = 'complete' | 'streaming' | 'error' | 'stopped';
export type MessageSource = 'live' | 'offline';

export interface CoachMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  /** Who wrote an assistant message: the live model or the built-in coach. */
  source?: MessageSource;
  provider?: string;
  model?: string;
  /** For built-in answers: the intent that matched. */
  intent?: string;
  /** Set when the live coach failed before any token and the built-in coach answered instead. */
  fallbackFrom?: AiErrorCode;
  /** Set when a live answer broke off; the partial text is kept. */
  error?: AiErrorCode;
}

export interface CoachNotice {
  id: string;
  kind: AiErrorCode;
  text: string;
}

export interface LiveState {
  ready: boolean;
  configured: boolean;
  provider: string | null;
  model: string | null;
  reason: ClientAiStatus['reason'] | 'unknown';
  /** The last live attempt failed before any token; cleared by the next live answer. */
  degraded: AiErrorCode | null;
}

export interface CoachState {
  messages: CoachMessage[];
  isStreaming: boolean;
  live: LiveState;
  notice: CoachNotice | null;
  /** True once a notice was shown in this session, so the user is told once. */
  noticeShown: boolean;

  append(message: CoachMessage): void;
  patch(id: string, changes: Partial<Omit<CoachMessage, 'id'>>): void;
  remove(id: string): void;
  removeAfter(id: string): void;
  clear(): void;
  setStreaming(value: boolean): void;
  setLive(changes: Partial<LiveState>): void;
  setNotice(notice: CoachNotice | null): void;
}

/** Messages kept on the device. Older ones are dropped, oldest first. */
export const MAX_STORED_MESSAGES = 60;
const MAX_STORED_CHARS = 4000;
export const STORE_VERSION = 1;
export const STORE_KEY = 'ecoquest.coach';

const initialLive: LiveState = {
  ready: false,
  configured: false,
  provider: null,
  model: null,
  reason: 'unknown',
  degraded: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STATUSES: readonly string[] = ['complete', 'streaming', 'error', 'stopped'];

/** Accepts only well-formed messages from storage; anything else is dropped. */
export function sanitizeMessages(value: unknown): CoachMessage[] {
  if (!Array.isArray(value)) return [];
  const out: CoachMessage[] = [];
  for (const item of value as unknown[]) {
    if (!isRecord(item)) continue;
    const { id, role, content, createdAt, status } = item;
    if (typeof id !== 'string' || id === '' || id.length > 80) continue;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) continue;
    const safeStatus =
      typeof status === 'string' && STATUSES.includes(status)
        ? (status as MessageStatus)
        : 'complete';
    // A message that was mid-stream when the page closed will never finish.
    const settled: MessageStatus = safeStatus === 'streaming' ? 'stopped' : safeStatus;
    if (role === 'assistant' && settled === 'stopped' && content.trim() === '') continue;
    const message: CoachMessage = {
      id,
      role,
      content: content.slice(0, MAX_STORED_CHARS),
      createdAt,
      status: settled,
    };
    if (item.source === 'live' || item.source === 'offline') message.source = item.source;
    if (typeof item.provider === 'string') message.provider = item.provider.slice(0, 60);
    if (typeof item.model === 'string') message.model = item.model.slice(0, 120);
    if (typeof item.intent === 'string') message.intent = item.intent.slice(0, 40);
    if (typeof item.fallbackFrom === 'string')
      message.fallbackFrom = item.fallbackFrom as AiErrorCode;
    if (typeof item.error === 'string') message.error = item.error as AiErrorCode;
    out.push(message);
  }
  return out.slice(-MAX_STORED_MESSAGES);
}

/** localStorage that never throws (private windows, blocked storage) and falls back to memory. */
export function safeStorage(): StateStorage {
  const memory = new Map<string, string>();
  const available = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    getItem(name) {
      try {
        return available()?.getItem(name) ?? memory.get(name) ?? null;
      } catch {
        return memory.get(name) ?? null;
      }
    },
    setItem(name, value) {
      memory.set(name, value);
      try {
        available()?.setItem(name, value);
      } catch {
        // Storage full or blocked: the in-memory copy keeps this session working.
      }
    },
    removeItem(name) {
      memory.delete(name);
      try {
        available()?.removeItem(name);
      } catch {
        // Nothing to clean up.
      }
    },
  };
}

export function createCoachStore(options: { name?: string; storage?: StateStorage } = {}) {
  const storage = options.storage ?? safeStorage();
  return create<CoachState>()(
    persist(
      (set) => ({
        messages: [],
        isStreaming: false,
        live: initialLive,
        notice: null,
        noticeShown: false,

        append: (message) =>
          set((state) => ({ messages: [...state.messages, message].slice(-MAX_STORED_MESSAGES) })),
        patch: (id, changes) =>
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === id ? { ...message, ...changes } : message,
            ),
          })),
        remove: (id) =>
          set((state) => ({ messages: state.messages.filter((message) => message.id !== id) })),
        removeAfter: (id) =>
          set((state) => {
            const index = state.messages.findIndex((message) => message.id === id);
            return index < 0 ? state : { messages: state.messages.slice(0, index + 1) };
          }),
        clear: () => set({ messages: [], notice: null, isStreaming: false }),
        setStreaming: (value) => set({ isStreaming: value }),
        setLive: (changes) => set((state) => ({ live: { ...state.live, ...changes } })),
        setNotice: (notice) =>
          set((state) => ({ notice, noticeShown: notice ? true : state.noticeShown })),
      }),
      {
        name: options.name ?? STORE_KEY,
        version: STORE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ messages: state.messages.slice(-MAX_STORED_MESSAGES) }),
        // Unknown or corrupt saved data never breaks the page: it just starts empty.
        migrate: (persisted) => ({
          messages: sanitizeMessages(isRecord(persisted) ? persisted.messages : []),
        }),
        merge: (persisted, current) => ({
          ...current,
          messages: sanitizeMessages(isRecord(persisted) ? persisted.messages : []),
        }),
      },
    ),
  );
}

export type CoachStore = ReturnType<typeof createCoachStore>;

export const useCoachStore: CoachStore = createCoachStore();
