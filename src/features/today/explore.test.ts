import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/world');
});

describe('Explore: the world decides', () => {
  it('has nothing to open while the world exports no Explore mode', async () => {
    vi.doMock('@/world', () => ({ WorldStage: () => null }));
    const { worldExplore } = await import('./explore');
    expect(worldExplore()).toBeNull();
  });

  it("opens the world's Explore mode once the barrel exports it", async () => {
    const openExplore = vi.fn();
    vi.doMock('@/world', () => ({ WorldStage: () => null, openExplore }));
    const { worldExplore } = await import('./explore');
    const open = worldExplore();
    expect(open).not.toBeNull();
    open?.();
    expect(openExplore).toHaveBeenCalledTimes(1);
  });
});
