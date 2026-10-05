/**
 * The conversation logic behind the coach, with no React in it so every race
 * (stop mid-stream, clear during a fallback, a late delta after stop) is
 * testable. `useCoach` is a thin hook over this.
 *
 * THE SEAM FOR GAME DATA: the controller never imports the game store. The
 * caller passes `getContext`, a function returning the current `CoachContext`.
 * It is called once per send, so the coach always sees fresh stats. Build it in
 * the game layer (or in a page) from the game selectors; return `{ region }`
 * alone when the user turned off "Share my stats with the coach".
 *
 * Live vs built-in: each send asks the server (cached) whether a key is
 * configured. Live answers stream through `streamChat`. If the live call fails
 * before any token arrives, the built-in coach answers the same message and the
 * user is told once, plainly. After the first token the answer is never
 * swapped: the partial text stays with an error flag and `retry()`.
 */
import type { StoreApi } from 'zustand';
import {
  AiError,
  getAiStatus as defaultGetAiStatus,
  isAiError,
  resetAiStatus as defaultResetStatus,
  streamChat as defaultStreamChat,
  type StreamChatParams,
} from './client';
import type {
  AiErrorCode,
  ChatMessage,
  ChatResult,
  ClientAiStatus,
  CoachContext,
} from './contract';
import { AI_LIMITS } from './contract';
import type { CoachMessage, CoachState } from './coachStore';
import { runOfflineCoach, type OfflineStreamOptions } from './offline';
import { OFFLINE_LABEL } from './offline/knowledge';

export interface CoachClient {
  getAiStatus(options?: { refresh?: boolean; signal?: AbortSignal }): Promise<ClientAiStatus>;
  streamChat(params: StreamChatParams): Promise<ChatResult>;
  resetStatus?(): void;
}

export interface CoachControllerOptions {
  store: StoreApi<CoachState>;
  getContext: () => CoachContext;
  client?: CoachClient;
  /** Words per second feel; zero shows built-in answers instantly (reduced motion). */
  wordDelayMs?: number;
  offlineSleep?: OfflineStreamOptions['sleep'];
  now?: () => number;
  newId?: () => string;
}

export type SendResult = { ok: true } | { ok: false; reason: 'empty' | 'too_long' | 'busy' };

let counter = 0;
function defaultId(): string {
  counter += 1;
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${random}-${counter}`;
}

const defaultClient: CoachClient = {
  getAiStatus: defaultGetAiStatus,
  streamChat: defaultStreamChat,
  resetStatus: defaultResetStatus,
};

/** The one plain sentence shown when the built-in coach steps in. */
export function fallbackNotice(code: AiErrorCode, retryAfterSec?: number): string {
  switch (code) {
    case 'not_configured':
      return "The live coach isn't set up here, so you're chatting with the built-in coach.";
    case 'offline':
      return "You're offline, so the built-in coach is answering.";
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil((retryAfterSec ?? 60) / 60));
      return `The coach needs a breather. Back in about ${minutes} min. The built-in coach is still here.`;
    }
    default:
      return "The live coach isn't answering right now, so the built-in coach is.";
  }
}

export interface CoachController {
  send(text: string): Promise<SendResult>;
  stop(): void;
  retry(): Promise<SendResult>;
  clear(): void;
  refreshStatus(refresh?: boolean): Promise<void>;
  dismissNotice(): void;
  /** Cancel anything in flight without touching the saved conversation (unmount). */
  dispose(): void;
}

export function createCoachController(options: CoachControllerOptions): CoachController {
  const { store, getContext } = options;
  const client = options.client ?? defaultClient;
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? defaultId;
  const wordDelayMs = options.wordDelayMs ?? 26;

  let run = 0;
  let abort: AbortController | null = null;

  const state = (): CoachState => store.getState();
  const stale = (id: number): boolean => id !== run;

  const safeContext = (): CoachContext => {
    try {
      return getContext();
    } catch {
      return {};
    }
  };

  /** What the model should see: finished turns plus the question being answered. */
  function history(upToUserId: string): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const message of state().messages) {
      if (
        message.role === 'assistant' &&
        (message.content.trim() === '' || message.status === 'streaming')
      ) {
        if (message.id === upToUserId) break;
        continue;
      }
      out.push({ role: message.role, content: message.content });
      if (message.id === upToUserId) break;
    }
    return out;
  }

  function announceFallback(code: AiErrorCode, retryAfterSec?: number): void {
    if (state().noticeShown) return;
    state().setNotice({ id: newId(), kind: code, text: fallbackNotice(code, retryAfterSec) });
  }

  async function answerBuiltIn(
    myRun: number,
    assistantId: string,
    question: string,
    fallbackFrom: AiErrorCode | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    state().patch(assistantId, {
      source: 'offline',
      provider: OFFLINE_LABEL,
      ...(fallbackFrom ? { fallbackFrom } : {}),
    });
    const answer = await runOfflineCoach({
      message: question,
      context: safeContext(),
      signal,
      wordDelayMs,
      sleep: options.offlineSleep,
      onDelta: (_piece, full) => {
        if (!stale(myRun)) state().patch(assistantId, { content: full, status: 'streaming' });
      },
    });
    if (stale(myRun)) return;
    state().patch(assistantId, { content: answer.text, status: 'complete', intent: answer.intent });
  }

  async function answer(
    userMessage: CoachMessage,
    assistantId: string,
    myRun: number,
    signal: AbortSignal,
  ): Promise<void> {
    const question = userMessage.content;
    let status: ClientAiStatus;
    try {
      status = await client.getAiStatus({ signal });
    } catch {
      if (stale(myRun)) return;
      status = { configured: false, provider: null, model: null, reason: 'offline' };
    }
    if (stale(myRun)) return;
    state().setLive({
      ready: true,
      configured: status.configured,
      provider: status.provider,
      model: status.model,
      reason: status.reason,
    });

    if (!status.configured) {
      if (status.reason === 'not_configured' || status.reason === 'no_functions') {
        announceFallback('not_configured');
        return answerBuiltIn(myRun, assistantId, question, 'not_configured', signal);
      }
      announceFallback('offline');
      return answerBuiltIn(myRun, assistantId, question, 'offline', signal);
    }

    try {
      const result = await client.streamChat({
        messages: history(userMessage.id),
        context: safeContext(),
        signal,
        onDelta: (_piece, full) => {
          if (!stale(myRun))
            state().patch(assistantId, { content: full, source: 'live', status: 'streaming' });
        },
      });
      if (stale(myRun)) return;
      state().patch(assistantId, {
        content: result.text,
        status: 'complete',
        source: 'live',
        provider: result.provider,
        model: result.model,
      });
      state().setLive({ degraded: null, provider: result.provider, model: result.model });
    } catch (error) {
      if (stale(myRun)) return;
      const failure = isAiError(error)
        ? error
        : new AiError('upstream_unavailable', 'The answer failed.');
      if (failure.code === 'aborted') return;
      if (failure.partial.trim() !== '') {
        // Tokens already reached the user: keep them, never swap the answer.
        state().patch(assistantId, {
          content: failure.partial,
          status: 'error',
          source: 'live',
          error: failure.code,
        });
        state().setLive({ degraded: failure.code });
        return;
      }
      state().setLive({ degraded: failure.code });
      if (failure.code === 'offline' || failure.code === 'not_configured') client.resetStatus?.();
      announceFallback(failure.code, failure.retryAfterSec);
      await answerBuiltIn(myRun, assistantId, question, failure.code, signal);
    }
  }

  async function runTurn(userMessage: CoachMessage): Promise<void> {
    run += 1;
    const myRun = run;
    const controller = new AbortController();
    abort = controller;
    const assistantId = newId();
    state().append({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now(),
      status: 'streaming',
    });
    state().setStreaming(true);
    try {
      await answer(userMessage, assistantId, myRun, controller.signal);
    } finally {
      if (!stale(myRun)) {
        const current = state().messages.find((message) => message.id === assistantId);
        // Safety net: nothing should leave an answer stuck in "streaming".
        if (current?.status === 'streaming') {
          state().patch(assistantId, {
            status: current.content.trim() === '' ? 'error' : 'complete',
          });
        }
        state().setStreaming(false);
        abort = null;
      }
    }
  }

  return {
    async send(text) {
      const trimmed = text.trim();
      if (trimmed === '') return { ok: false, reason: 'empty' };
      if ([...trimmed].length > AI_LIMITS.maxUserChars) return { ok: false, reason: 'too_long' };
      if (state().isStreaming) return { ok: false, reason: 'busy' };
      const userMessage: CoachMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        createdAt: now(),
        status: 'complete',
      };
      state().append(userMessage);
      await runTurn(userMessage);
      return { ok: true };
    },

    stop() {
      if (!state().isStreaming) return;
      abort?.abort();
      abort = null;
      run += 1;
      const last = state().messages[state().messages.length - 1];
      if (last?.role === 'assistant' && last.status === 'streaming') {
        if (last.content.trim() === '') state().remove(last.id);
        else state().patch(last.id, { status: 'stopped' });
      }
      state().setStreaming(false);
    },

    async retry() {
      if (state().isStreaming) return { ok: false, reason: 'busy' };
      const messages = state().messages;
      let lastUser: CoachMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const candidate = messages[i];
        if (candidate?.role === 'user') {
          lastUser = candidate;
          break;
        }
      }
      if (!lastUser) return { ok: false, reason: 'empty' };
      // Drop whatever answered (or failed to answer) that question, then ask again.
      state().removeAfter(lastUser.id);
      await runTurn(lastUser);
      return { ok: true };
    },

    clear() {
      abort?.abort();
      abort = null;
      run += 1;
      state().clear();
    },

    async refreshStatus(refresh = true) {
      try {
        const status = await client.getAiStatus({ refresh });
        state().setLive({
          ready: true,
          configured: status.configured,
          provider: status.provider,
          model: status.model,
          reason: status.reason,
          ...(status.configured ? {} : { degraded: null }),
        });
      } catch {
        state().setLive({ ready: true, configured: false, reason: 'offline' });
      }
    },

    dismissNotice() {
      state().setNotice(null);
    },

    dispose() {
      abort?.abort();
      abort = null;
      run += 1;
      if (state().isStreaming) {
        const last = state().messages[state().messages.length - 1];
        if (last?.role === 'assistant' && last.status === 'streaming') {
          if (last.content.trim() === '') state().remove(last.id);
          else state().patch(last.id, { status: 'stopped' });
        }
        state().setStreaming(false);
      }
    },
  };
}
