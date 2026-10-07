import { afterEach, describe, expect, it } from 'vitest';
import { useCelebrationStore } from './celebrationStore';

afterEach(() => useCelebrationStore.getState().clear());

describe('the celebration queue after an undo', () => {
  it('drops a level-up the user no longer holds and keeps everything else', () => {
    const store = useCelebrationStore.getState();
    store.enqueue([
      { kind: 'badge', name: 'First Leaf', emoji: '🍃', tier: 1, tiers: 1, xp: 20 },
      { kind: 'level-up', level: 2, title: 'Seed Sower' },
      { kind: 'streak', days: 3, xp: 15 },
    ]);
    store.dropLevelsAbove(1);
    expect(useCelebrationStore.getState().queue.map((entry) => entry.kind)).toEqual([
      'badge',
      'streak',
    ]);
  });

  it('keeps a level-up that still stands', () => {
    const store = useCelebrationStore.getState();
    store.enqueue([{ kind: 'level-up', level: 2, title: 'Seed Sower' }]);
    const before = useCelebrationStore.getState().queue;
    store.dropLevelsAbove(2);
    expect(useCelebrationStore.getState().queue).toBe(before);
  });
});
