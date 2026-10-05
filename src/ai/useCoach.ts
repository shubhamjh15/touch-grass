/**
 * React hook for the coach UI. All behaviour lives in `coachController`; this
 * wires it to the persisted store, refreshes the live/built-in status when the
 * browser comes back online, and cancels anything in flight on unmount.
 *
 * `getContext` is the seam to the game: return the user's current
 * `CoachContext` (see contract.ts). It is read at send time, so it may close
 * over fresh state without being memoised.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createCoachController, type CoachClient, type SendResult } from './coachController';
import { useCoachStore, type CoachMessage, type CoachNotice } from './coachStore';
import { AI_LIMITS, type CoachContext } from './contract';
import { OFFLINE_LABEL } from './offline/knowledge';

export type CoachMode = 'live' | 'offline';

export interface UseCoachOptions {
  /** Show built-in answers instantly instead of word by word (pass true for reduced motion). */
  instant?: boolean;
  /** Test seam: replaces the network client. */
  client?: CoachClient;
}

export interface UseCoach {
  messages: CoachMessage[];
  /** "live" when a provider key is configured and working, otherwise "offline" (the built-in coach). */
  mode: CoachMode;
  /** "Groq", "Google Gemini", ... or "Built-in coach". Show it next to answers. */
  label: string;
  /** The model id behind a live label, for a tooltip or the settings screen. */
  model: string | null;
  isStreaming: boolean;
  /** False until the first status check has finished. */
  ready: boolean;
  /** One plain sentence when the built-in coach stepped in; shown once per session. */
  notice: CoachNotice | null;
  maxLength: number;
  send(text: string): Promise<SendResult>;
  stop(): void;
  retry(): Promise<SendResult>;
  clear(): void;
  dismissNotice(): void;
  /** Re-ask the server whether a key is configured (for a "Retry live" button). */
  refreshStatus(): Promise<void>;
}

export function useCoach(getContext: () => CoachContext, options: UseCoachOptions = {}): UseCoach {
  const contextRef = useRef(getContext);
  useEffect(() => {
    contextRef.current = getContext;
  }, [getContext]);

  const { instant = false, client } = options;
  const controller = useMemo(
    () =>
      createCoachController({
        store: useCoachStore,
        getContext: () => contextRef.current(),
        wordDelayMs: instant ? 0 : undefined,
        client,
      }),
    [instant, client],
  );

  useEffect(() => {
    void controller.refreshStatus(false);
    const onOnline = (): void => void controller.refreshStatus(true);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      controller.dispose();
    };
  }, [controller]);

  const { messages, isStreaming, live, notice } = useCoachStore(
    useShallow((state) => ({
      messages: state.messages,
      isStreaming: state.isStreaming,
      live: state.live,
      notice: state.notice,
    })),
  );

  const mode: CoachMode = live.configured && live.degraded === null ? 'live' : 'offline';
  const label = mode === 'live' ? (live.provider ?? 'AI coach') : OFFLINE_LABEL;

  const send = useCallback((text: string) => controller.send(text), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const retry = useCallback(() => controller.retry(), [controller]);
  const clear = useCallback(() => controller.clear(), [controller]);
  const dismissNotice = useCallback(() => controller.dismissNotice(), [controller]);
  const refreshStatus = useCallback(() => controller.refreshStatus(true), [controller]);

  return {
    messages,
    mode,
    label,
    model: mode === 'live' ? live.model : null,
    isStreaming,
    ready: live.ready,
    notice,
    maxLength: AI_LIMITS.maxUserChars,
    send,
    stop,
    retry,
    clear,
    dismissNotice,
    refreshStatus,
  };
}
