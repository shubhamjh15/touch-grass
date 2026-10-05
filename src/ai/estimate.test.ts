import { describe, expect, it, vi } from 'vitest';
import { AiError } from './client';
import type { ActionEstimate, ClientAiStatus } from './contract';
import { estimateCustomAction, estimateLocally, estimateSourceLabel } from './estimate';

const catalogue = [
  { id: 'move_bike_trip', title: 'Cycled instead of driving', unit: 'km' },
  { id: 'eat_veg_meal', title: 'Vegetarian meal', unit: 'meals' },
  { id: 'stuff_repair', title: 'Repaired instead of replacing', unit: 'item' },
  { id: 'power_line_dry', title: 'Air-dried a load', unit: 'loads' },
];

const ready: ClientAiStatus = { configured: true, provider: 'Groq', model: 'm', reason: 'ready' };
const idle: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};

const aiEstimate: ActionEstimate = {
  isClimateAction: true,
  matchedActionId: null,
  title: 'Fixed a bike',
  emoji: '🔧',
  category: 'shopping',
  effort: 3,
  quantity: 1,
  unit: 'item',
  co2Kg: 0.4,
  confidence: 'low',
  reasoning: 'A repair avoids a replacement.',
};

describe('estimateLocally', () => {
  it('recognises common actions and uses conservative numbers with low confidence', () => {
    const cycling = estimateLocally('cycled 5 km to work', { actions: catalogue });
    expect(cycling.recognised).toBe(true);
    expect(cycling.source).toBe('heuristic');
    expect(cycling.estimate).toMatchObject({
      category: 'transport',
      quantity: 5,
      unit: 'km',
      confidence: 'low',
      matchedActionId: 'move_bike_trip',
      co2Kg: null,
    });
  });

  it('gives a number when no catalogue action matches', () => {
    const outcome = estimateLocally('cycled 5 km to work');
    expect(outcome.estimate).toMatchObject({
      co2Kg: 0.5,
      matchedActionId: null,
      confidence: 'low',
    });
    expect(outcome.estimate.reasoning).toMatch(/rough guess/i);
  });

  it('converts miles and ignores numbers without a matching unit', () => {
    expect(estimateLocally('cycled 10 miles').estimate.quantity).toBe(16.1);
    expect(estimateLocally('cycled for 30 minutes').estimate.quantity).toBe(3);
  });

  it('reads meals and loads', () => {
    expect(estimateLocally('had 2 vegetarian meals').estimate).toMatchObject({
      quantity: 2,
      co2Kg: 1.6,
      category: 'food',
    });
    expect(estimateLocally('line dried 3 loads of washing').estimate).toMatchObject({
      quantity: 3,
      category: 'energy',
    });
  });

  it('does not mistake repairing a bike for cycling', () => {
    const outcome = estimateLocally("fixed my neighbour's bike", { actions: catalogue });
    expect(outcome.estimate).toMatchObject({
      category: 'shopping',
      matchedActionId: 'stuff_repair',
    });
  });

  it('says so when it recognises nothing, with no number', () => {
    const outcome = estimateLocally('learned the ukulele');
    expect(outcome.recognised).toBe(false);
    expect(outcome.estimate).toMatchObject({
      co2Kg: null,
      confidence: 'low',
      title: 'Learned the ukulele',
    });
    expect(outcome.estimate.reasoning).toMatch(/no number/);
  });

  it('gives no number for actions without an honest factor', () => {
    expect(estimateLocally('picked up litter in the park').estimate).toMatchObject({
      co2Kg: null,
      category: 'nature',
    });
    expect(estimateLocally('sorted the recycling').estimate.co2Kg).toBeNull();
  });

  it('never exceeds the per-log cap, whatever the quantity', () => {
    const huge = estimateLocally('took the train 5000 km');
    expect(huge.estimate.co2Kg).toBeLessThanOrEqual(5);
    expect(estimateLocally('cycled 9999999 km').estimate.co2Kg).toBeLessThanOrEqual(5);
  });

  it('respects a typed quantity over one in the text', () => {
    expect(estimateLocally('cycled 5 km', { quantity: 8 }).estimate.quantity).toBe(8);
  });

  it('keeps titles within 60 characters and handles empty and odd input', () => {
    expect(estimateLocally('x'.repeat(200)).estimate.title.length).toBeLessThanOrEqual(60);
    expect(estimateLocally('').estimate.title).toBe('Something else');
    expect(() => estimateLocally('!!!???')).not.toThrow();
  });

  it('is deterministic', () => {
    expect(estimateLocally('cycled 5 km', { actions: catalogue })).toEqual(
      estimateLocally('cycled 5 km', { actions: catalogue }),
    );
  });
});

describe('estimateCustomAction', () => {
  it('uses the server estimate when a live AI is configured', async () => {
    const client = {
      getAiStatus: vi.fn().mockResolvedValue(ready),
      estimateAction: vi.fn().mockResolvedValue(aiEstimate),
    };
    const outcome = await estimateCustomAction('fixed a bike', {
      actions: catalogue,
      region: 'eu',
      quantity: 2,
      client,
    });
    expect(outcome).toEqual({ estimate: aiEstimate, source: 'ai', recognised: true });
    expect(client.estimateAction).toHaveBeenCalledWith(
      'fixed a bike',
      'eu',
      expect.objectContaining({ quantity: 2, catalogue }),
    );
    expect(estimateSourceLabel(outcome)).toBe('AI estimate');
  });

  it('skips the network when no AI is configured and labels the local path', async () => {
    const client = { getAiStatus: vi.fn().mockResolvedValue(idle), estimateAction: vi.fn() };
    const outcome = await estimateCustomAction('cycled 3 km', { client });
    expect(client.estimateAction).not.toHaveBeenCalled();
    expect(outcome.source).toBe('heuristic');
    expect(estimateSourceLabel(outcome)).toBe('Rough local estimate');
  });

  it('falls back to the heuristic on any server failure', async () => {
    for (const code of [
      'estimate_failed',
      'offline',
      'timeout',
      'rate_limited',
      'not_configured',
    ] as const) {
      const client = {
        getAiStatus: vi.fn().mockResolvedValue(ready),
        estimateAction: vi.fn().mockRejectedValue(new AiError(code, 'x')),
      };
      expect((await estimateCustomAction('cycled 3 km', { client })).source).toBe('heuristic');
    }
    const broken = {
      getAiStatus: vi.fn().mockRejectedValue(new TypeError('boom')),
      estimateAction: vi.fn(),
    };
    expect((await estimateCustomAction('cycled 3 km', { client: broken })).source).toBe(
      'heuristic',
    );
  });

  it('re-throws an abort instead of hiding it behind a guess', async () => {
    const client = {
      getAiStatus: vi.fn().mockResolvedValue(ready),
      estimateAction: vi.fn().mockRejectedValue(new AiError('aborted', 'x')),
    };
    await expect(estimateCustomAction('cycled 3 km', { client })).rejects.toMatchObject({
      code: 'aborted',
    });
  });
});
