import { describe, expect, it, vi } from 'vitest';
import { isAiError, type CoachClient } from '@/ai';
import { LIVE_BUDGET, checkLiveBudget, withLiveBudget } from './liveBudget';

const MIN = 60_000;
const now = 10 * 60 * MIN;

describe('checkLiveBudget', () => {
  it('allows thirty live messages an hour', () => {
    const sends = Array.from({ length: LIVE_BUDGET.max - 1 }, (_, index) => now - index * MIN);
    expect(checkLiveBudget(sends, now)).toEqual({ ok: true, left: 1 });
  });

  it('says when the next slot frees up once the budget is spent', () => {
    // Thirty requests, the oldest 50 minutes ago: a slot frees in 10 minutes.
    const sends = Array.from({ length: LIVE_BUDGET.max }, (_, index) => now - 50 * MIN + index);
    expect(checkLiveBudget(sends, now)).toEqual({ ok: false, retryAfterSec: 600 });
  });

  it('forgets requests older than an hour', () => {
    const sends = Array.from({ length: 40 }, () => now - 61 * MIN);
    expect(checkLiveBudget(sends, now)).toEqual({ ok: true, left: LIVE_BUDGET.max });
  });
});

describe('withLiveBudget', () => {
  function setup(sent: number[]) {
    const base: CoachClient = {
      getAiStatus: vi.fn(async () => ({
        configured: true,
        provider: 'Groq',
        model: 'm',
        reason: 'ready' as const,
      })),
      streamChat: vi.fn(async () => ({ text: 'ok', provider: 'Groq', model: 'm', finish: 'stop' })),
    };
    const client = withLiveBudget(base, {
      now: () => now,
      sends: () => sent,
      record: (moment) => sent.push(moment),
    });
    return { base, client };
  }

  it('spends from the budget on each live request', async () => {
    const sent: number[] = [];
    const { base, client } = setup(sent);
    await client.streamChat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(sent).toEqual([now]);
    expect(base.streamChat).toHaveBeenCalledTimes(1);
  });

  it('never calls the server over budget: it fails like a rate limit, with the wait', async () => {
    const sent = Array.from({ length: LIVE_BUDGET.max }, () => now - 30 * MIN);
    const { base, client } = setup(sent);
    const failure: unknown = await client
      .streamChat({ messages: [{ role: 'user', content: 'hi' }] })
      .catch((error: unknown) => error);
    expect(isAiError(failure) && failure.code).toBe('rate_limited');
    expect(isAiError(failure) && failure.retryAfterSec).toBe(1800);
    expect(base.streamChat).not.toHaveBeenCalled();
    expect(sent).toHaveLength(LIVE_BUDGET.max);
  });
});
