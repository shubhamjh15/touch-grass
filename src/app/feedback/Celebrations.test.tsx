import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions } from '@/game';
import { Celebrations } from './Celebrations';
import { useCelebrationStore } from './celebrationStore';

const world = vi.hoisted(() => ({ emitPulse: vi.fn() }));
vi.mock('@/world', () => ({ emitPulse: world.emitPulse }));
vi.mock('canvas-confetti', () => ({ default: vi.fn(async () => undefined) }));

beforeEach(() => {
  world.emitPulse.mockClear();
  gameActions.resetAll();
  act(() => useCelebrationStore.getState().clear());
});

describe('<Celebrations>', () => {
  it('shows nothing until something is queued', () => {
    render(<Celebrations />);
    expect(document.querySelector('[data-celebration]')).toBeNull();
    expect(world.emitPulse).not.toHaveBeenCalled();
  });

  it('announces a level-up, makes the world answer once, and can be skipped with a tap', () => {
    render(<Celebrations />);
    act(() => {
      useCelebrationStore
        .getState()
        .enqueue([{ kind: 'level-up', level: 6, title: 'Sprout Scout' }]);
    });
    expect(screen.getByText('Level 6. Sprout Scout.')).toBeInTheDocument();
    expect(world.emitPulse).toHaveBeenCalledTimes(1);
    expect(world.emitPulse).toHaveBeenCalledWith({ kind: 'level-up', level: 6 });

    fireEvent.click(document.querySelector('[data-celebration="level-up"]') as Element);
    expect(document.querySelector('[data-celebration]')).toBeNull();
  });

  it('plays one at a time: the badge first, the level-up after it', () => {
    render(<Celebrations />);
    act(() => {
      useCelebrationStore.getState().enqueue([
        { kind: 'badge', name: 'Bookworm', emoji: '📚', tier: 1, tiers: 3, xp: 40 },
        { kind: 'level-up', level: 6, title: 'Sprout Scout' },
      ]);
    });
    expect(document.querySelector('[data-celebration="badge"]')).not.toBeNull();
    expect(document.querySelector('[data-celebration="level-up"]')).toBeNull();
    expect(world.emitPulse).toHaveBeenLastCalledWith({ kind: 'badge' });

    fireEvent.click(document.querySelector('[data-celebration="badge"]') as Element);
    expect(document.querySelector('[data-celebration="level-up"]')).not.toBeNull();
    expect(world.emitPulse).toHaveBeenLastCalledWith({ kind: 'level-up', level: 6 });
  });
});
