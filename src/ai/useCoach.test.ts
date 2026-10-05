import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachClient } from './coachController';
import { useCoachStore } from './coachStore';
import type { ChatResult, ClientAiStatus } from './contract';
import { useCoach } from './useCoach';

const live: ClientAiStatus = {
  configured: true,
  provider: 'Groq',
  model: 'openai/gpt-oss-120b',
  reason: 'ready',
};
const none: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};
const result: ChatResult = {
  text: 'Hi from the model',
  provider: 'Groq',
  model: 'openai/gpt-oss-120b',
  finish: 'stop',
};

function fakeClient(
  status: ClientAiStatus,
): CoachClient & { streamChat: ReturnType<typeof vi.fn> } {
  return {
    getAiStatus: vi.fn(async () => status),
    streamChat: vi.fn(async ({ onDelta }) => {
      onDelta?.(result.text, result.text);
      return result;
    }),
    resetStatus: vi.fn(),
  };
}

beforeEach(() => {
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
});

describe('useCoach', () => {
  it('starts in the built-in mode, then reports the live provider once the status arrives', async () => {
    const client = fakeClient(live);
    const { result: hook } = renderHook(() => useCoach(() => ({}), { client }));
    expect(hook.current.mode).toBe('offline');
    expect(hook.current.label).toBe('Built-in coach');
    await waitFor(() => expect(hook.current.ready).toBe(true));
    expect(hook.current.mode).toBe('live');
    expect(hook.current.label).toBe('Groq');
    expect(hook.current.model).toBe('openai/gpt-oss-120b');
    expect(hook.current.maxLength).toBe(600);
  });

  it('sends through the live model and exposes the messages', async () => {
    const client = fakeClient(live);
    const { result: hook } = renderHook(() => useCoach(() => ({ region: 'eu' }), { client }));
    await act(async () => {
      await hook.current.send('hello');
    });
    expect(hook.current.messages.map((m) => m.content)).toEqual(['hello', 'Hi from the model']);
    expect(hook.current.isStreaming).toBe(false);
    expect(client.streamChat.mock.calls[0]?.[0].context).toEqual({ region: 'eu' });
  });

  it('uses the latest getContext without being re-created', async () => {
    const client = fakeClient(live);
    let region = 'eu';
    const { result: hook, rerender } = renderHook(() => useCoach(() => ({ region }), { client }));
    region = 'us';
    rerender();
    await act(async () => {
      await hook.current.send('hello');
    });
    expect(client.streamChat.mock.calls[0]?.[0].context).toEqual({ region: 'us' });
  });

  it('answers with the built-in coach and surfaces the one-time notice when there is no key', async () => {
    const client = fakeClient(none);
    const { result: hook } = renderHook(() => useCoach(() => ({}), { client, instant: true }));
    await act(async () => {
      await hook.current.send('one easy win');
    });
    expect(client.streamChat).not.toHaveBeenCalled();
    expect(hook.current.mode).toBe('offline');
    expect(hook.current.notice?.text).toMatch(/built-in coach/);
    expect(hook.current.messages[1]?.source).toBe('offline');
    act(() => hook.current.dismissNotice());
    expect(hook.current.notice).toBeNull();
  });

  it('clear empties the conversation', async () => {
    const client = fakeClient(live);
    const { result: hook } = renderHook(() => useCoach(() => ({}), { client }));
    await act(async () => {
      await hook.current.send('hello');
    });
    act(() => hook.current.clear());
    expect(hook.current.messages).toEqual([]);
  });

  it('cancels an in-flight answer when the component unmounts, keeping what arrived', async () => {
    const client = fakeClient(live);
    client.streamChat.mockImplementationOnce(async ({ onDelta }) => {
      onDelta?.('Typing', 'Typing');
      return new Promise<ChatResult>(() => undefined);
    });
    const { result: hook, unmount } = renderHook(() => useCoach(() => ({}), { client }));
    void act(() => {
      void hook.current.send('hello');
    });
    await waitFor(() => expect(useCoachStore.getState().messages.at(-1)?.content).toBe('Typing'));
    unmount();
    expect(useCoachStore.getState().isStreaming).toBe(false);
    expect(useCoachStore.getState().messages.at(-1)?.status).toBe('stopped');
  });

  it('re-checks the status when the browser comes back online', async () => {
    const client = fakeClient(none);
    const { result: hook } = renderHook(() => useCoach(() => ({}), { client }));
    await waitFor(() => expect(hook.current.ready).toBe(true));
    expect(client.getAiStatus).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(client.getAiStatus).toHaveBeenCalledTimes(2));
    expect(client.getAiStatus).toHaveBeenLastCalledWith({ refresh: true });
  });
});
