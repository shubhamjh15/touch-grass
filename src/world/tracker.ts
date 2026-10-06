import type { StageMode, WorldSnapshot } from './contract';
import { MOTION } from './config';
import { applySkyVars, clearSkyVars, skyAt } from './daylight';
import { stepSpring, type Spring } from './framing';
import { invalidateStageRects, orbit } from './interaction';
import { useWorldStore, type StageRecord } from './store';

/**
 * The world's heartbeat, and the one place that decides where the world is on the page.
 *
 * The world layer (the printed sky and the WebGL canvas) is a single DOM node that
 * LIVES INSIDE the active stage: when another stage becomes active the node is moved
 * into it. While it stands in a stage the browser lays it out and scrolls it like any
 * other element, on the compositor, so it can never trail the page, and nothing here
 * reads layout per frame. Layout is read only when the stage changes (twice, to fly the
 * world from where it was to where it is going), and sizes arrive from a ResizeObserver.
 *
 * Between two stages the move is a short transform on top of the new place (FLIP). With
 * no stage at all (a route is loading) the layer is parked in the fixed backdrop exactly
 * where it was, held for a moment and then faded out.
 *
 * Lives in the main bundle (no three.js): the sky follows stages even while the 3D chunk
 * is loading or when 3D is off. The loop stops itself whenever nothing can be seen.
 */

export interface WorldFrame {
  /** Seconds since the tracker started, and since the previous frame (clamped). */
  time: number;
  dt: number;
  /** CSS size of the world layer: the active stage's box, in whole pixels. */
  view: { width: number; height: number };
  fit: number;
  /** 0 = centred in the box, 1 = standing on its bottom edge. */
  anchor: number;
  mode: StageMode;
  /** Final opacity of the world (appear, disappear and reduced-motion cross-fade). */
  opacity: number;
  /** Scale multiplier of the first-appearance pop: settles at 1. */
  appear: number;
  /** True while the layer is still travelling from the previous stage. */
  flying: boolean;
  reducedMotion: boolean;
  /** False when nothing would be visible (tab hidden, faded out, stage off screen). */
  render: boolean;
  /** The live snapshot with the active stage's `preview` applied. */
  snapshot: WorldSnapshot;
  stage: StageRecord | null;
  /** Yaw of the island (idle motion, drag, keys, hover) and extra camera elevation, radians. */
  yaw: number;
  tilt: number;
  /** True while the user is turning the island or it is still coasting. */
  interacting: boolean;
  /** True when the world stands in its stage, at rest: not flying, not fading. */
  locked: boolean;
}

type FrameListener = (frame: WorldFrame) => void;
const listeners = new Set<FrameListener>();
let wakeTracker: (() => void) | null = null;
let replayAppear: (() => void) | null = null;

/**
 * Replays the first-appearance pop. The scene calls it when its first frame is on
 * screen, because by then the pop that ran while the 3D chunk was loading is long over.
 */
export function popWorld(): void {
  replayAppear?.();
}

/** Scene-side subscription to the per-frame state. Returns an unsubscribe function. */
export function onWorldFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  wakeTracker?.();
  return () => {
    listeners.delete(listener);
  };
}

export interface TrackerLayers {
  /** The fixed, full-viewport backdrop: where the layer waits while no stage has it. */
  backdrop: HTMLElement;
  /** The world layer (sky plate and canvas): moved into the active stage's host. */
  layer: HTMLElement;
  /** The printed sky inside the layer. */
  sky: HTMLElement;
}

/** The element of a stage that receives the world layer. */
const hostOf = (stage: StageRecord): HTMLElement | null =>
  stage.el.querySelector<HTMLElement>(':scope > [data-world-host]');

const rest = (): Spring => ({ x: 0, v: 0 });

/** Steps per hour in which the page-wide sky tokens follow the clock. */
const ROOT_SKY_STEPS = 12;

export function startTracker(layers: TrackerLayers): () => void {
  const { backdrop, layer, sky } = layers;
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** The flight: offset of the layer's centre in pixels and the log of its scale. */
  const offset = { x: rest(), y: rest(), s: rest() };
  /** 1 right after a stage change, springs to 0: blends fit, anchor and sky amount. */
  const blend = rest();
  const appear = rest();
  const from = { fit: 0.86, anchor: 1, sky: 0 };
  const shown = { fit: 0.86, anchor: 1, sky: 0 };
  /** Reduced motion: 0..1 progress of the fade that replaces a flight. */
  let dip = 1;

  let raf = 0;
  let started = 0;
  let last = 0;
  let placed = false;
  let presence = 0;
  let absentMs = 0;
  /** Where the layer is: inside this stage's host, or parked in the backdrop (`null`). */
  let host: HTMLElement | null = null;
  let stageId: string | null = null;
  let skyHour = Number.NaN;
  let pageHour = Number.NaN;
  /** The stage that carries a previewed hour's sky on its own element, and that hour. */
  const previewSky: { el: HTMLElement | null; hour: number } = { el: null, hour: Number.NaN };
  let cachedSnapshot: WorldSnapshot | null = null;
  let cachedPreview: Partial<WorldSnapshot> | null = null;
  let merged: WorldSnapshot = useWorldStore.getState().snapshot;
  const written = { transform: '', opacity: '', skyOpacity: '' };

  const frame: WorldFrame = {
    time: 0,
    dt: 0,
    view: { width: 1, height: 1 },
    fit: 0.86,
    anchor: 1,
    mode: 'companion',
    opacity: 0,
    appear: 1,
    flying: false,
    reducedMotion: false,
    render: false,
    snapshot: merged,
    stage: null,
    yaw: 0,
    tilt: 0,
    interacting: false,
    locked: false,
  };

  const isReduced = () => {
    const { motion } = useWorldStore.getState();
    return motion === 'reduced' || (motion === 'system' && reducedQuery.matches);
  };

  const schedule = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  };

  /** Lays the layer out as a plain child filling its stage. */
  function standIn(target: HTMLElement): void {
    const { style } = layer;
    style.left = '0';
    style.top = '0';
    style.width = '100%';
    style.height = '100%';
    style.borderRadius = 'inherit';
    target.appendChild(layer);
  }

  /** Leaves the layer in the fixed backdrop, exactly where it was on screen. */
  function park(rect: DOMRect | null, radius: string): void {
    const { style } = layer;
    if (rect && rect.width >= 2 && rect.height >= 2) {
      style.left = `${rect.left}px`;
      style.top = `${rect.top}px`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
      style.borderRadius = radius;
    } else {
      presence = 0;
    }
    backdrop.appendChild(layer);
  }

  /**
   * Puts the layer where the store says the world should be. A no-op unless the active
   * stage changed, so it is safe to call on every store change and every frame. This is
   * the only code that reads layout, and only at the moment of a change.
   */
  function place(): void {
    const state = useWorldStore.getState();
    const stage = (state.activeStageId && state.stages[state.activeStageId]) || null;
    const target = stage ? hostOf(stage) : null;
    if (target === host && (target === null || stage?.id === stageId)) return;

    const visible = placed && presence > 0.04 && layer.isConnected;
    const before = visible ? layer.getBoundingClientRect() : null;
    if (!stage || !target) {
      const radius = host ? getComputedStyle(layer).borderTopLeftRadius : layer.style.borderRadius;
      park(before, radius);
      host = null;
      stageId = null;
      for (const spring of Object.values(offset)) Object.assign(spring, rest());
      return;
    }

    standIn(target);
    host = target;
    stageId = stage.id;
    absentMs = 0;
    const after = target.getBoundingClientRect();
    frame.view.width = Math.max(1, Math.round(after.width));
    frame.view.height = Math.max(1, Math.round(after.height));
    const reduced = isReduced();
    const travels = before !== null && before.width >= 2 && after.width >= 2;
    if (!travels) {
      // First appearance: nothing to fly from, so pop in where the stage is.
      for (const spring of Object.values(offset)) Object.assign(spring, rest());
      Object.assign(blend, rest());
      appear.x = reduced ? 0 : 1;
      appear.v = 0;
      dip = 1;
      placed = true;
    } else if (reduced) {
      for (const spring of Object.values(offset)) Object.assign(spring, rest());
      Object.assign(blend, rest());
      dip = 0;
    } else {
      // FLIP: the jump becomes an offset that springs back to zero. Velocities are kept,
      // so retargeting mid-flight stays smooth. The scale flies in log space.
      offset.x.x = before.left + before.width / 2 - (after.left + after.width / 2);
      offset.y.x = before.top + before.height / 2 - (after.top + after.height / 2);
      offset.s.x =
        Math.log((before.width * before.height) / Math.max(1, after.width * after.height)) / 2;
      Object.assign(from, shown);
      blend.x = 1;
      blend.v = 0;
    }
    // A companion stage with a sky is a printed plate; the others bleed to the edges.
    sky.dataset.frame = stage.options.mode === 'companion' ? 'plate' : 'bleed';
    sky.dataset.mode = stage.options.mode;
  }

  function tick(now: number): void {
    raf = 0;
    if (!started) started = now;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;

    place();
    const state = useWorldStore.getState();
    const stage = (stageId && state.stages[stageId]) || null;
    const reduced = isReduced();

    if (stage && host) {
      const options = stage.options;
      const wantsSky = options.sky ? 1 : 0;
      const wantsAnchor = options.anchor === 'bottom' ? 1 : 0;
      // At rest every offset is zero and the layer is simply the stage's child: nothing
      // here moves it, the browser does.
      stepSpring(offset.x, dt, MOTION.flightOmega, MOTION.flightZeta);
      stepSpring(offset.y, dt, MOTION.flightOmega, MOTION.flightZeta);
      stepSpring(offset.s, dt, MOTION.flightOmega, 1);
      stepSpring(blend, dt, MOTION.flightOmega, 1);
      shown.fit = options.fit + (from.fit - options.fit) * blend.x;
      shown.anchor = wantsAnchor + (from.anchor - wantsAnchor) * blend.x;
      shown.sky = wantsSky + (from.sky - wantsSky) * blend.x;
      frame.mode = options.mode;
      frame.flying = offset.x.x !== 0 || offset.y.x !== 0 || offset.s.x !== 0;
      if (dip < 1) dip = Math.min(1, dip + (dt * 1000) / MOTION.crossFadeMs);
      presence = Math.min(1, presence + dt * 14 + (dt === 0 ? 0.05 : 0));
    } else {
      // No stage: the parked layer holds its place and, after a short grace for lazy
      // routes, fades out.
      absentMs += dt * 1000;
      if (absentMs > MOTION.graceMs) {
        presence = Math.max(0, presence - dt * MOTION.fadeOutPerSecond);
      }
      frame.flying = false;
    }
    stepSpring(appear, dt, MOTION.appearOmega, MOTION.appearZeta);

    // The sky follows the hour of whatever the active stage previews.
    if (cachedSnapshot !== state.snapshot || cachedPreview !== (stage?.options.preview ?? null)) {
      cachedSnapshot = state.snapshot;
      cachedPreview = stage?.options.preview ?? null;
      merged = cachedPreview ? { ...state.snapshot, ...cachedPreview } : state.snapshot;
    }
    if (!(Math.abs(merged.hour - skyHour) < 0.004)) {
      skyHour = merged.hour;
      applySkyVars(layer, skyAt(skyHour));
    }
    // The page's own sky tokens live on the root element, where a change restyles the
    // whole document: they follow the real clock in five-minute steps, a handful of writes
    // per hour. An hour that a stage only previews (the landing's time-lapse scrubs a year of
    // them while the page scrolls) is written on that stage instead, so its own chips match
    // the sky behind them and nothing outside the stage is restyled.
    const pageStep = Math.round(state.snapshot.hour * ROOT_SKY_STEPS);
    if (pageStep !== pageHour) {
      pageHour = pageStep;
      applySkyVars(document.documentElement, skyAt(pageStep / ROOT_SKY_STEPS));
    }
    const previewEl = stage && cachedPreview?.hour !== undefined ? stage.el : null;
    if (previewEl !== previewSky.el || (previewEl && previewSky.hour !== skyHour)) {
      if (previewSky.el && previewSky.el !== previewEl) clearSkyVars(previewSky.el);
      if (previewEl) applySkyVars(previewEl, skyAt(skyHour));
      previewSky.el = previewEl;
      previewSky.hour = skyHour;
    }

    // The island's yaw belongs to the frame.
    const interactive = Boolean(stage && host && stage.options.interactive);
    orbit.step(
      dt,
      stage ? stage.options.mode : frame.mode,
      reduced,
      interactive,
      stage?.options.explore === true,
    );
    frame.yaw = orbit.yaw;
    frame.tilt = orbit.pitch;
    frame.interacting = orbit.moving;
    frame.locked = Boolean(stage && host) && !frame.flying && dip >= 1 && presence >= 1;

    const opacity = presence * dip;
    frame.time = (now - started) / 1000;
    frame.dt = dt;
    frame.fit = shown.fit;
    frame.anchor = shown.anchor;
    frame.opacity = opacity;
    frame.appear = 1 - (1 - MOTION.appearFrom) * appear.x;
    frame.reducedMotion = reduced;
    frame.snapshot = merged;
    frame.stage = stage;
    // A stage reports how much of it is on screen through its IntersectionObserver; a
    // parked layer is where the stage was, which was on screen.
    const onScreen = stage ? stage.visible > 0 : host === null;
    frame.render = placed && opacity > 0.002 && onScreen && frame.view.width >= 2;

    const transform = frame.flying
      ? `translate3d(${offset.x.x.toFixed(2)}px, ${offset.y.x.toFixed(2)}px, 0) scale(${Math.exp(offset.s.x).toFixed(4)})`
      : '';
    const layerOpacity = opacity.toFixed(3);
    const skyOpacity = shown.sky.toFixed(3);
    if (transform !== written.transform) layer.style.transform = written.transform = transform;
    if (layerOpacity !== written.opacity) layer.style.opacity = written.opacity = layerOpacity;
    if (skyOpacity !== written.skyOpacity) sky.style.opacity = written.skyOpacity = skyOpacity;

    listeners.forEach((listener) => listener(frame));

    // Keep ticking only while something can be seen or is still settling. A world whose
    // stage has scrolled away requests no frames at all: the store change that reports
    // it visible again (or a new snapshot, or a new stage) wakes the loop.
    const settling = frame.flying || dip < 1 || (stage !== null && presence < 1);
    const fading = !stage && presence > 0;
    if (frame.render || settling || fading) schedule();
  }

  const wake = () => {
    if (!raf) last = 0;
    schedule();
  };
  // The stage a page just removed must be left before its element is gone, and the one
  // it just added entered before the next paint: both happen in the store callback.
  const onStore = () => {
    place();
    wake();
  };
  const onViewport = () => {
    invalidateStageRects();
    wake();
  };
  const measure = new ResizeObserver((entries) => {
    const size = entries.at(-1)?.contentRect;
    if (!size || host === null) return;
    frame.view.width = Math.max(1, Math.round(size.width));
    frame.view.height = Math.max(1, Math.round(size.height));
    invalidateStageRects();
    wake();
  });
  measure.observe(layer);
  wakeTracker = wake;
  const pop = () => {
    if (isReduced()) return;
    appear.x = 1;
    appear.v = 0;
  };
  replayAppear = pop;
  const unsubscribe = useWorldStore.subscribe(onStore);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('resize', onViewport);
  window.addEventListener('scroll', invalidateStageRects, { capture: true, passive: true });
  onStore();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (wakeTracker === wake) wakeTracker = null;
    if (replayAppear === pop) replayAppear = null;
    unsubscribe();
    measure.disconnect();
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('resize', onViewport);
    window.removeEventListener('scroll', invalidateStageRects, { capture: true });
    // React still believes the layer is the backdrop's child: give it back.
    layer.style.transform = '';
    backdrop.appendChild(layer);
    if (previewSky.el) clearSkyVars(previewSky.el);
    previewSky.el = null;
    host = null;
    stageId = null;
  };
}
