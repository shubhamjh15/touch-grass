import { describe, expect, it, vi } from 'vitest';
import { AiError } from './client';
import { createCoachController, fallbackNotice, type CoachClient } from './coachController';
import { createCoachStore, type CoachStore } from './coachStore';
import type { ChatResult, ClientAiStatus, CoachContext } from './contract';

const live: ClientAiStatus = {
  configured: true,
  provider: 'Groq',
  model: 'openai/gpt-oss-120b',
  reason: 'ready',
};
const notConfigured: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};
const offlineStatus: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'offline',
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => void data.set(name, value),
    removeItem: (name: string) => void data.delete(name),
    data,
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const result = (text: string): ChatResult => ({
  text,
  provider: 'Groq',
  model: 'openai/gpt-oss-120b',
  finish: 'stop',
});

function setup(options: { status?: ClientAiStatus; context?: () => CoachContext } = {}) {
  const store: CoachStore = createCoachStore({ storage: memoryStorage(), name: 'test' });
  const client = {
    getAiStatus: vi.fn<CoachClient['getAiStatus']>(async () => options.status ?? live),
    streamChat: vi.fn<CoachClient['streamChat']>(async ({ onDelta }) => {
      onDelta?.('Hello', 'Hello');
      onDelta?.(' there', 'Hello there');
      return result('Hello there');
    }),
    resetStatus: vi.fn(),
  };
  let n = 0;
  const getContext = vi.fn(
    options.context ?? ((): CoachContext => ({ region: 'eu', tree: { name: 'Juniper' } })),
  );
  const controller = createCoachController({
    store,
    client,
    getContext,
    wordDelayMs: 0,
    now: () => 1_700_000_000_000 + n,
    newId: () => `id${(n += 1)}`,
  });
  return { store, client, controller, getContext, state: () => store.getState() };
}

describe('live answers', () => {
  it('streams an answer into an assistant message and records the provider', async () => {
    const { controller, state, client, getContext } = setup();
    expect(await controller.send('One easy win?')).toEqual({ ok: true });
    const [user, assistant] = state().messages;
    expect(user).toMatchObject({ role: 'user', content: 'One easy win?', status: 'complete' });
    expect(assistant).toMatchObject({
      role: 'assistant',
      content: 'Hello there',
      status: 'complete',
      source: 'live',
      provider: 'Groq',
      model: 'openai/gpt-oss-120b',
    });
    expect(state().isStreaming).toBe(false);
    expect(state().live).toMatchObject({ configured: true, provider: 'Groq', degraded: null });
    expect(state().notice).toBeNull();
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(client.streamChat.mock.calls[0]?.[0].context).toEqual({
      region: 'eu',
      tree: { name: 'Juniper' },
    });
  });

  it('shows the answer as it arrives', async () => {
    const { controller, state, client } = setup();
    const gate = deferred<ChatResult>();
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Par', 'Par');
      return gate.promise;
    });
    const pending = controller.send('hi');
    await vi.waitFor(() => expect(state().messages[1]?.content).toBe('Par'));
    expect(state().isStreaming).toBe(true);
    expect(state().messages[1]?.status).toBe('streaming');
    gate.resolve(result('Partial done'));
    await pending;
    expect(state().messages[1]).toMatchObject({ content: 'Partial done', status: 'complete' });
  });

  it('sends the earlier finished turns as history and ends with the new question', async () => {
    const { controller, client } = setup();
    await controller.send('first');
    await controller.send('second');
    const sent = client.streamChat.mock.calls[1]?.[0].messages;
    expect(sent).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'Hello there' },
      { role: 'user', content: 'second' },
    ]);
  });

  it('refuses empty, too-long and overlapping sends', async () => {
    const { controller, state, client } = setup();
    expect(await controller.send('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(await controller.send('x'.repeat(601))).toEqual({ ok: false, reason: 'too_long' });
    expect(state().messages).toHaveLength(0);
    const gate = deferred<ChatResult>();
    client.streamChat.mockImplementationOnce(() => gate.promise);
    const first = controller.send('one');
    const second = await controller.send('two');
    expect(second).toEqual({ ok: false, reason: 'busy' });
    gate.resolve(result('ok'));
    await first;
    expect(state().messages.filter((m) => m.role === 'user')).toHaveLength(1);
  });

  it('survives a getContext that throws', async () => {
    const { controller, client } = setup({
      context: () => {
        throw new Error('game store not ready');
      },
    });
    await controller.send('hi');
    expect(client.streamChat.mock.calls[0]?.[0].context).toEqual({});
  });
});

describe('falling back to the built-in coach', () => {
  it('answers with the built-in coach and tells the user once when no key is configured', async () => {
    const { controller, state, client } = setup({ status: notConfigured });
    await controller.send('one easy win');
    expect(client.streamChat).not.toHaveBeenCalled();
    const assistant = state().messages[1];
    expect(assistant).toMatchObject({
      source: 'offline',
      status: 'complete',
      intent: 'easy_win',
      fallbackFrom: 'not_configured',
      provider: 'Built-in coach',
    });
    expect(assistant?.content.length).toBeGreaterThan(20);
    expect(state().notice?.text).toMatch(/isn't set up/);
    expect(state().live.configured).toBe(false);
    const firstNoticeId = state().notice?.id;

    controller.dismissNotice();
    expect(state().notice).toBeNull();
    await controller.send('what is co2e');
    expect(state().notice).toBeNull();
    expect(firstNoticeId).toBeTruthy();
  });

  it('reports a dead network as offline', async () => {
    const { controller, state } = setup({ status: offlineStatus });
    await controller.send('hi');
    expect(state().notice?.text).toMatch(/offline/);
    expect(state().messages[1]).toMatchObject({ source: 'offline', fallbackFrom: 'offline' });
  });

  it('falls back mid-conversation when the live call fails before any token', async () => {
    const { controller, state, client } = setup();
    await controller.send('hi');
    expect(state().messages[1]?.source).toBe('live');
    client.streamChat.mockRejectedValueOnce(new AiError('upstream_unavailable', 'x'));
    await controller.send('one easy win');
    const last = state().messages[3];
    expect(last).toMatchObject({
      source: 'offline',
      fallbackFrom: 'upstream_unavailable',
      status: 'complete',
    });
    expect(state().live.degraded).toBe('upstream_unavailable');
    expect(state().notice?.text).toMatch(/isn't answering right now/);
    // The next send tries live again, and a good answer clears the degraded flag.
    await controller.send('again');
    expect(state().messages[5]).toMatchObject({ source: 'live' });
    expect(state().live.degraded).toBeNull();
  });

  it('turns a rate limit into a plain breather message with minutes', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockRejectedValueOnce(
      new AiError('rate_limited', 'x', { retryAfterSec: 125 }),
    );
    await controller.send('hi');
    expect(state().notice?.text).toBe(
      'Moss needs a breather. Back in 3 min — the built-in coach is still here.',
    );
    expect(fallbackNotice('rate_limited')).toMatch(/Back in 1 min/);
  });

  it('resets the cached status after a connection failure so the next send re-checks', async () => {
    const { controller, client } = setup();
    client.streamChat.mockRejectedValueOnce(new AiError('offline', 'x'));
    await controller.send('hi');
    expect(client.resetStatus).toHaveBeenCalled();
  });

  it('treats a failing status check as offline', async () => {
    const { controller, state, client } = setup();
    client.getAiStatus.mockRejectedValueOnce(new Error('boom'));
    await controller.send('hi');
    expect(state().messages[1]).toMatchObject({ source: 'offline', fallbackFrom: 'offline' });
  });

  it('never swaps an answer after the first token: it keeps the partial text and flags the error', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Half an', 'Half an');
      throw new AiError('upstream_unavailable', 'cut', { partial: 'Half an' });
    });
    await controller.send('hi');
    expect(state().messages).toHaveLength(2);
    expect(state().messages[1]).toMatchObject({
      content: 'Half an',
      status: 'error',
      source: 'live',
      error: 'upstream_unavailable',
    });
    expect(state().notice).toBeNull();
    expect(state().isStreaming).toBe(false);
  });
});

describe('stop', () => {
  it('keeps the partial text as a stopped message', async () => {
    const { controller, state, client } = setup();
    const gate = deferred<ChatResult>();
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Some words', 'Some words');
      return gate.promise;
    });
    const pending = controller.send('hi');
    await vi.waitFor(() => expect(state().messages[1]?.content).toBe('Some words'));
    controller.stop();
    expect(state().isStreaming).toBe(false);
    expect(state().messages[1]).toMatchObject({ content: 'Some words', status: 'stopped' });
    // The request finishing late must not change anything.
    gate.resolve(result('The late full answer'));
    await pending;
    expect(state().messages[1]).toMatchObject({ content: 'Some words', status: 'stopped' });
  });

  it('aborts the request signal', async () => {
    const { controller, client } = setup();
    let signal: AbortSignal | undefined;
    client.streamChat.mockImplementationOnce(({ signal: s }) => {
      signal = s;
      return new Promise<ChatResult>(() => undefined);
    });
    void controller.send('hi');
    await vi.waitFor(() => expect(signal).toBeDefined());
    controller.stop();
    expect(signal?.aborted).toBe(true);
  });

  it('removes the placeholder when nothing had arrived yet', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockImplementationOnce(() => new Promise<ChatResult>(() => undefined));
    void controller.send('hi');
    await vi.waitFor(() => expect(state().isStreaming).toBe(true));
    controller.stop();
    expect(state().messages.map((m) => m.role)).toEqual(['user']);
  });

  it('stops the built-in coach mid-sentence', async () => {
    const store: CoachStore = createCoachStore({ storage: memoryStorage(), name: 'offline-stop' });
    const gates: Deferred<void>[] = [];
    const controller = createCoachController({
      store,
      client: { getAiStatus: async () => notConfigured, streamChat: vi.fn() },
      getContext: () => ({}),
      wordDelayMs: 10,
      offlineSleep: (_ms, signal) => {
        const gate = deferred<void>();
        gates.push(gate);
        signal?.addEventListener('abort', () => gate.resolve());
        return gate.promise;
      },
    });
    const pending = controller.send('one easy win');
    await vi.waitFor(() => expect(gates.length).toBe(1));
    gates[0]?.resolve();
    await vi.waitFor(() => expect(gates.length).toBe(2));
    gates[1]?.resolve();
    await vi.waitFor(() => expect(gates.length).toBe(3));
    const before = store.getState().messages[1]?.content ?? '';
    expect(before.length).toBeGreaterThan(0);
    controller.stop();
    await pending;
    const stopped = store.getState().messages[1];
    expect(stopped?.status).toBe('stopped');
    expect(stopped?.content.length).toBeGreaterThanOrEqual(before.length);
    expect(stopped?.content.length).toBeLessThan(120);
    expect(store.getState().isStreaming).toBe(false);
  });

  it('does nothing when nothing is streaming', () => {
    const { controller, state } = setup();
    controller.stop();
    expect(state().messages).toHaveLength(0);
  });

  it('lets a new question be asked right after a stop, without the old one leaking in', async () => {
    const { controller, state, client } = setup();
    const gate = deferred<ChatResult>();
    client.streamChat.mockImplementationOnce(() => gate.promise);
    const first = controller.send('first');
    await vi.waitFor(() => expect(state().isStreaming).toBe(true));
    controller.stop();
    await controller.send('second');
    gate.resolve(result('STALE ANSWER'));
    await first;
    const contents = state().messages.map((m) => m.content);
    expect(contents).toEqual(['first', 'second', 'Hello there']);
    expect(state().isStreaming).toBe(false);
  });
});

describe('retry', () => {
  it('re-asks the last question and replaces a failed answer', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockImplementationOnce(async () => {
      throw new AiError('upstream_unavailable', 'cut', { partial: 'Half' });
    });
    await controller.send('hi');
    expect(state().messages[1]?.status).toBe('error');
    expect(await controller.retry()).toEqual({ ok: true });
    expect(state().messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'hi', 'complete'],
      ['assistant', 'Hello there', 'complete'],
    ]);
  });

  it('replaces a built-in fallback answer with a live one once the coach is back', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockRejectedValueOnce(new AiError('upstream_unavailable', 'x'));
    await controller.send('hi');
    expect(state().messages[1]?.source).toBe('offline');
    await controller.retry();
    expect(state().messages).toHaveLength(2);
    expect(state().messages[1]).toMatchObject({ source: 'live', content: 'Hello there' });
  });

  it('retries after a stop', async () => {
    const { controller, state, client } = setup();
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Part', 'Part');
      return new Promise<ChatResult>(() => undefined);
    });
    void controller.send('hi');
    await vi.waitFor(() => expect(state().messages[1]?.content).toBe('Part'));
    controller.stop();
    await controller.retry();
    expect(state().messages).toHaveLength(2);
    expect(state().messages[1]?.content).toBe('Hello there');
  });

  it('refuses when there is nothing to retry or an answer is streaming', async () => {
    const { controller, state, client } = setup();
    expect(await controller.retry()).toEqual({ ok: false, reason: 'empty' });
    client.streamChat.mockImplementationOnce(() => new Promise<ChatResult>(() => undefined));
    void controller.send('hi');
    await vi.waitFor(() => expect(state().isStreaming).toBe(true));
    expect(await controller.retry()).toEqual({ ok: false, reason: 'busy' });
    controller.stop();
  });
});

describe('clear and dispose', () => {
  it('clears the conversation and cancels the request; a late answer does not come back', async () => {
    const { controller, state, client } = setup();
    const gate = deferred<ChatResult>();
    let signal: AbortSignal | undefined;
    client.streamChat.mockImplementationOnce(({ signal: s }) => {
      signal = s;
      return gate.promise;
    });
    const pending = controller.send('hi');
    await vi.waitFor(() => expect(signal).toBeDefined());
    controller.clear();
    expect(signal?.aborted).toBe(true);
    expect(state().messages).toEqual([]);
    expect(state().isStreaming).toBe(false);
    gate.resolve(result('late'));
    await pending;
    expect(state().messages).toEqual([]);
  });

  it('clears the notice too', async () => {
    const { controller, state } = setup({ status: notConfigured });
    await controller.send('hi');
    expect(state().notice).not.toBeNull();
    controller.clear();
    expect(state().notice).toBeNull();
  });

  it('dispose aborts in-flight work without erasing the saved conversation', async () => {
    const { controller, state, client } = setup();
    await controller.send('first');
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Typing', 'Typing');
      return new Promise<ChatResult>(() => undefined);
    });
    void controller.send('second');
    await vi.waitFor(() => expect(state().messages.at(-1)?.content).toBe('Typing'));
    controller.dispose();
    expect(state().isStreaming).toBe(false);
    expect(state().messages.at(-1)).toMatchObject({ content: 'Typing', status: 'stopped' });
    expect(state().messages).toHaveLength(4);
  });
});

describe('status', () => {
  it('refreshStatus records what the server says', async () => {
    const { controller, state, client } = setup();
    await controller.refreshStatus();
    expect(state().live).toMatchObject({ ready: true, configured: true, provider: 'Groq' });
    expect(client.getAiStatus).toHaveBeenCalledWith({ refresh: true });
    client.getAiStatus.mockRejectedValueOnce(new Error('x'));
    await controller.refreshStatus();
    expect(state().live).toMatchObject({ ready: true, configured: false, reason: 'offline' });
  });
});
