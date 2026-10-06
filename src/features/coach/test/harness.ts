import { readFileSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { resetAiStatus, useCoachStore } from '@/ai';
import { STORAGE_KEYS, game, gameActions, getGameState, type GameState } from '@/game';
import { setMotionPreference } from '@/lib/hooks';
import { useCoachUi } from '../coachUi';

/**
 * What the coach tests share: a saved game loaded into the real store as the screenshot
 * fixtures do, a pinned clock, and a fake `/api` so the live coach can be exercised without
 * a network. Everything resets between tests.
 */

type Fixture = Record<string, { state: GameState; version: number } | undefined>;

/** Fixtures are anchored to the morning of 6 October 2026: "day12" is the twelfth day at 10:30. */
export const FIXTURE_NOW = new Date(2026, 9, 6, 10, 31).getTime();

/** Loads a fixture into the game store, pins the clock to its morning and returns that moment. */
export function seedGame(name: string): number {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Fixture)[STORAGE_KEYS.game];
  if (!saved) throw new Error(`fixture ${name} has no saved game`);
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  game.setClock(() => FIXTURE_NOW);
  game.rehydrate();
  gameActions.tick();
  return FIXTURE_NOW;
}

export function restoreClock(): void {
  setMotionPreference('system');
  game.setClock(() => Date.now());
  gameActions.resetAll();
}

/**
 * An empty chat, an unknown live status and no remembered request budget. Motion is reduced so
 * the built-in coach answers at once instead of word by word.
 */
export function resetCoach(): void {
  setMotionPreference('reduced');
  useCoachStore.setState({
    messages: [],
    isStreaming: false,
    notice: null,
    noticeShown: false,
    live: {
      ready: false,
      configured: false,
      provider: null,
      model: null,
      reason: 'unknown',
      degraded: null,
    },
  });
  useCoachUi.getState().reset();
  resetAiStatus();
}

const encoder = new TextEncoder();

export const delta = (text: string): string =>
  `event: delta\ndata: ${JSON.stringify({ text })}\n\n`;

export const done = (provider = 'Groq', model = 'test-model'): string =>
  `event: done\ndata: ${JSON.stringify({ provider, model, finish: 'stop' })}\n\n`;

/** A streamed chat answer made of the given server-sent events. */
export function sse(events: readonly string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export interface FakeApiOptions {
  configured: boolean;
  provider?: string;
  chat?: () => Response | Promise<Response>;
}

export interface FakeApi {
  /** Parsed bodies of every `/api/chat` request. */
  chats: Record<string, unknown>[];
  /** Raw bodies of every request, to check what must never be sent. */
  sent: string[];
}

/** Stands in for `fetch`: `/api/status` answers from the options, `/api/chat` from `chat`. */
export function fakeApi({ configured, provider = 'Groq', chat }: FakeApiOptions): FakeApi {
  const api: FakeApi = { chats: [], sent: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/status')) {
        return Promise.resolve(
          json(
            configured
              ? { configured: true, provider, model: 'test-model' }
              : { configured: false, provider: null, model: null },
          ),
        );
      }
      if (url.endsWith('/chat') && chat) {
        const raw = typeof init?.body === 'string' ? init.body : '';
        api.sent.push(raw);
        api.chats.push(JSON.parse(raw) as Record<string, unknown>);
        const answer = Promise.resolve(chat());
        const signal = init?.signal;
        if (!signal) return answer;
        return new Promise<Response>((resolve, reject) => {
          const abort = (): void => reject(new DOMException('Aborted', 'AbortError'));
          if (signal.aborted) return abort();
          signal.addEventListener('abort', abort, { once: true });
          answer.then(resolve, reject);
        });
      }
      return Promise.resolve(json({ error: { code: 'not_found', message: 'no such route' } }, 404));
    }),
  );
  return api;
}

export const logsOf = (actionId: string) =>
  getGameState().logs.filter((log) => log.actionId === actionId);
