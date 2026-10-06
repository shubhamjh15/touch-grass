import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAGE_DEFAULTS } from './config';
import type { StageMode } from './contract';
import { useWorldStore, type StageOptions } from './store';
import { onWorldFrame, startTracker, type WorldFrame } from './tracker';

const options = (mode: StageMode, priority = 0): StageOptions => ({
  mode,
  preview: null,
  interactive: false,
  landmarks: false,
  onLandmark: null,
  fit: STAGE_DEFAULTS[mode].fit,
  anchor: STAGE_DEFAULTS[mode].anchor,
  priority,
  sky: mode !== 'companion',
  explore: false,
});

/** A stage element as `WorldStage` renders it: a box with a host for the world layer. */
function mountStage(id: string, mode: StageMode, priority = 0) {
  const el = document.createElement('div');
  const host = document.createElement('div');
  host.dataset.worldHost = '';
  // jsdom lays nothing out: give the stage a size.
  host.getBoundingClientRect = () => new DOMRect(0, 0, 800, 500);
  el.append(host);
  document.body.append(el);
  useWorldStore.getState().registerStage(id, el, options(mode, priority));
  return { el, host };
}

describe('tracker', () => {
  let frames: FrameRequestCallback[] = [];
  let now = 0;
  let backdrop: HTMLDivElement;
  let layer: HTMLDivElement;
  let sky: HTMLDivElement;
  let stop: () => void;

  /** Runs the animation frames that were requested, `count` times, 16 ms apart. */
  const run = (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      const due = frames;
      frames = [];
      now += 16;
      for (const callback of due) callback(now);
    }
  };

  beforeEach(() => {
    frames = [];
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
    backdrop = document.createElement('div');
    layer = document.createElement('div');
    sky = document.createElement('div');
    layer.append(sky);
    backdrop.append(layer);
    document.body.append(backdrop);
    stop = startTracker({ backdrop, layer, sky });
  });

  afterEach(() => {
    stop();
    const { stages, unregisterStage } = useWorldStore.getState();
    for (const id of Object.keys(stages)) unregisterStage(id);
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('waits in the backdrop while no stage wants the world', () => {
    run(3);
    expect(layer.parentElement).toBe(backdrop);
  });

  it('puts the world layer inside the active stage, so the page scrolls it', () => {
    const { host } = mountStage('a', 'hub');
    // No frame has run yet: the move happens in the store callback, before the next paint.
    expect(layer.parentElement).toBe(host);
    expect(layer.style.width).toBe('100%');
    expect(sky.dataset.frame).toBe('bleed');
  });

  it('moves to the stage that takes over and marks a companion as a plate', () => {
    const first = mountStage('a', 'hub');
    const second = mountStage('b', 'companion', 5);
    useWorldStore.getState().setStageVisibility('a', 1);
    useWorldStore.getState().setStageVisibility('b', 1);
    expect(layer.parentElement).toBe(second.host);
    expect(sky.dataset.frame).toBe('plate');
    useWorldStore.getState().unregisterStage('b');
    expect(layer.parentElement).toBe(first.host);
  });

  it('parks in the backdrop the moment its stage is unregistered, before the element goes', () => {
    const { el, host } = mountStage('a', 'hero');
    expect(layer.parentElement).toBe(host);
    useWorldStore.getState().unregisterStage('a');
    expect(layer.parentElement).toBe(backdrop);
    el.remove();
    run(2);
    expect(layer.isConnected).toBe(true);
  });

  it('reads no layout while the world stands in its stage', () => {
    mountStage('a', 'hub');
    useWorldStore.getState().setStageVisibility('a', 1);
    run(4);
    const read = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    run(60);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('renders only while the stage is on screen, and stops asking for frames when it is not', () => {
    const seen: WorldFrame[] = [];
    const unsubscribe = onWorldFrame((frame) => seen.push({ ...frame }));
    mountStage('a', 'hub');
    run(2);
    expect(seen.at(-1)?.render).toBe(false);
    useWorldStore.getState().setStageVisibility('a', 0.6);
    run(30);
    expect(seen.at(-1)?.render).toBe(true);
    expect(seen.at(-1)?.locked).toBe(true);
    expect(seen.at(-1)?.mode).toBe('hub');
    useWorldStore.getState().setStageVisibility('a', 0);
    run(3);
    expect(seen.at(-1)?.render).toBe(false);
    expect(frames).toHaveLength(0);
    // Scrolling it back into view wakes the loop through the store.
    useWorldStore.getState().setStageVisibility('a', 0.2);
    expect(frames).toHaveLength(1);
    unsubscribe();
  });

  it('gives the layer back to the backdrop when it stops', () => {
    const { host } = mountStage('a', 'hub');
    expect(layer.parentElement).toBe(host);
    stop();
    expect(layer.parentElement).toBe(backdrop);
  });
});
