import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANDMARKS } from './contract';
import { useWorldStore } from './store';
import { WorldStage } from './WorldStage';

const setStatus = (status: 'idle' | 'loading' | 'ready' | 'fallback') =>
  act(() => useWorldStore.getState().setStatus(status));

afterEach(() => {
  act(() => {
    useWorldStore.setState({ status: 'idle', stages: {}, activeStageId: null });
  });
});

describe('WorldStage', () => {
  it('is a labelled picture when it only shows the tree', () => {
    render(<WorldStage mode="companion" label="Juniper, a young oak" />);
    const stage = screen.getByRole('img', { name: 'Juniper, a young oak' });
    expect(stage).not.toHaveAttribute('tabindex');
    expect(stage.dataset.worldStage).toBe('companion');
  });

  it('registers with the world while mounted and leaves nothing behind', () => {
    const { unmount } = render(<WorldStage mode="hero" />);
    const { stages, activeStageId } = useWorldStore.getState();
    expect(Object.keys(stages)).toHaveLength(1);
    expect(activeStageId).toBe(Object.keys(stages)[0]);
    expect(Object.values(stages)[0]?.options).toMatchObject({
      mode: 'hero',
      interactive: true,
      landmarks: false,
      sky: true,
    });
    unmount();
    expect(useWorldStore.getState().stages).toEqual({});
    expect(useWorldStore.getState().activeStageId).toBeNull();
  });

  it('survives a StrictMode-style remount with a single registration', () => {
    const first = render(<WorldStage mode="hub" />);
    first.unmount();
    render(<WorldStage mode="hub" />);
    expect(Object.keys(useWorldStore.getState().stages)).toHaveLength(1);
  });

  it('is a group, not a picture, once it carries landmarks', () => {
    render(<WorldStage mode="hub" landmarks label="Your grove" />);
    expect(screen.queryByRole('img', { name: 'Your grove' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Your grove' })).toBeInTheDocument();
  });

  it('lays the landmark buttons out as a grid when there is no 3D, in the contract order', () => {
    const onLandmark = vi.fn();
    render(
      <WorldStage
        mode="hub"
        landmarks
        onLandmark={onLandmark}
        landmarkMeta={{ quests: '1/3' }}
        label="Your grove"
      />,
    );
    setStatus('fallback');
    const stage = screen.getByRole('group', { name: 'Your grove' });
    const buttons = within(stage).getAllByRole('button');
    expect(buttons.map((button) => button.dataset.landmark)).toEqual([...LANDMARKS]);
    expect(stage.querySelector('[data-world-callouts]')?.getAttribute('data-world-callouts')).toBe(
      'grid',
    );
    expect(within(stage).getByRole('button', { name: /Quests/ })).toHaveTextContent('1/3');
    // Without WebGL the stage cannot be turned, so it takes no focus of its own.
    expect(stage).not.toHaveAttribute('tabindex');

    fireEvent.click(within(stage).getByRole('button', { name: 'Ask Moss' }));
    expect(onLandmark).toHaveBeenCalledWith('coach');
  });

  it('shows no landmark buttons while the 3D scene is still loading', () => {
    render(<WorldStage mode="hub" landmarks label="Your grove" />);
    setStatus('loading');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('becomes focusable and explains itself once the 3D scene can be turned', () => {
    render(<WorldStage mode="hub" landmarks label="Your grove" />);
    setStatus('ready');
    const stage = screen.getByRole('group', { name: 'Your grove' });
    expect(stage).toHaveAttribute('tabindex', '0');
    expect(stage).toHaveAccessibleDescription(/arrow keys/);
    // Tracked buttons exist in the contract order and stay hidden until the scene places them.
    const layer = stage.querySelector('[data-world-callouts="tracked"]');
    expect(layer).not.toBeNull();
    const wraps = [...(layer?.querySelectorAll<HTMLElement>('[data-callout]') ?? [])];
    expect(wraps.map((wrap) => wrap.dataset.callout)).toEqual([...LANDMARKS]);
    for (const wrap of wraps) expect(wrap.style.visibility).toBe('hidden');
  });

  it('does not take focus when interaction is switched off', () => {
    render(<WorldStage mode="hero" interactive={false} label="A tree" />);
    setStatus('ready');
    expect(screen.getByRole('img', { name: 'A tree' })).not.toHaveAttribute('tabindex');
  });

  it('keeps page overlays inside the stage box', () => {
    render(
      <WorldStage mode="companion" label="A tree">
        <p>Day 12</p>
      </WorldStage>,
    );
    expect(within(screen.getByRole('img', { name: 'A tree' })).getByText('Day 12')).toBeVisible();
  });

  it('offers the world layer a host as its first child, under everything else in the box', () => {
    render(
      <WorldStage mode="hub" label="Your grove">
        <p>Day 12</p>
      </WorldStage>,
    );
    const stage = screen.getByRole('group', { name: 'Your grove' });
    const host = stage.firstElementChild;
    expect(host).toHaveAttribute('data-world-host');
    expect(host).toHaveAttribute('aria-hidden', 'true');
    // Nothing of React's lives in it: the tracker may move the canvas in and out freely.
    expect(host?.childElementCount).toBe(0);
  });
});
