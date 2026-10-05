import type { StageMode, WorldSnapshot } from './contract';
import { MOTION } from './config';
import { applySkyVars, skyAt } from './daylight';
import { boxesIntersect, stepSpring, type Box, type Spring } from './framing';
import { useWorldStore, type StageRecord } from './store';

/**
 * The world's heartbeat. One requestAnimationFrame loop that, every frame:
 *
 *   1. reads the canvas rectangle and the active stage rectangle,
 *   2. turns them into the box the world should occupy (locked 1:1 to the stage while
 *      it stays the same, flown on a spring when the active stage changes),
 *   3. writes the printed sky layer to that box,
 *   4. hands the frame to the scene, which renders the Grove into the same box.
 *
 * Reads, sky and WebGL all happen in the same task, so the DOM and the canvas can
 * never be a frame apart. Lives in the main bundle (no three.js): the sky follows
 * stages even while the 3D chunk is loading or when 3D is off.
 */

export interface WorldFrame {
  /** Seconds since the tracker started, and since the previous frame (clamped). */
  time: number;
  dt: number;
  /** CSS size of the canvas, measured this frame (not `window.innerHeight`). */
  canvas: { width: number; height: number };
  /** Box the world occupies, relative to the canvas. Mid-flight it is between two stages. */
  box: Box;
  fit: number;
  /** 0 = centred in the box, 1 = standing on its bottom edge. */
  anchor: number;
  mode: StageMode;
  /** Final opacity of the world (appear, disappear and reduced-motion cross-fade). */
  opacity: number;
  /** Scale multiplier of the first-appearance pop: settles at 1. */
  appear: number;
  /** 0..1: how far the sticker is peeled off the page while it is carried between stages. */
  lift: number;
  /** Velocity of the box centre in px/s while flying. Zero when locked to a stage. */
  velocityX: number;
  velocityY: number;
  flying: boolean;
  reducedMotion: boolean;
  /** False when nothing would be visible (tab hidden, faded out, box off screen). */
  render: boolean;
  /** The live snapshot with the active stage's `preview` applied. */
  snapshot: WorldSnapshot;
  stage: StageRecord | null;
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

/** Scene-side subscription to the per-frame placement. Returns an unsubscribe function. */
export function onWorldFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  wakeTracker?.();
  return () => {
    listeners.delete(listener);
  };
}

export interface TrackerLayers {
  /** The fixed, full-viewport backdrop. Its rectangle is the canvas rectangle. */
  backdrop: HTMLElement;
  /** The printed sky: sized and moved to the world's box. */
  sky: HTMLElement;
  /** Wrapper of the WebGL canvas: receives the world's opacity. */
  scene: HTMLElement;
}

const rest = (): Spring => ({ x: 0, v: 0 });

export function startTracker(layers: TrackerLayers): () => void {
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const offset = { cx: rest(), cy: rest(), w: rest(), h: rest() };
  /** 1 right after a stage change, springs to 0: blends fit, anchor and sky amount. */
  const blend = rest();
  const appear = rest();
  const from = { fit: 0.86, anchor: 1, sky: 0 };
  const shown = { fit: 0.86, anchor: 1, sky: 0 };
  let dip: { box: Box; fit: number; anchor: number; sky: number; t: number } | null = null;

  let raf = 0;
  let started = 0;
  let last = 0;
  let placed = false;
  let presence = 0;
  let absentMs = 0;
  let stageId: string | null = null;
  /** 0..1: short hops are carried flat, long flights lift off and arc. */
  let carry = 0;
  let skyHour = Number.NaN;
  let cachedSnapshot: WorldSnapshot | null = null;
  let cachedPreview: Partial<WorldSnapshot> | null = null;
  let merged: WorldSnapshot = useWorldStore.getState().snapshot;
  const written = {
    transform: '',
    width: '',
    height: '',
    skyOpacity: '',
    sceneOpacity: '',
    radius: '',
  };

  const frame: WorldFrame = {
    time: 0,
    dt: 0,
    canvas: { width: 1, height: 1 },
    box: { x: 0, y: 0, width: 1, height: 1 },
    fit: 0.86,
    anchor: 1,
    mode: 'companion',
    opacity: 0,
    appear: 1,
    lift: 0,
    velocityX: 0,
    velocityY: 0,
    flying: false,
    reducedMotion: false,
    render: false,
    snapshot: merged,
    stage: null,
  };

  const schedule = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  };

  function writeLayers(opacity: number, skyAmount: number): void {
    const { box } = frame;
    const transform = `translate3d(${box.x.toFixed(2)}px, ${box.y.toFixed(2)}px, 0)`;
    const width = `${box.width.toFixed(2)}px`;
    const height = `${box.height.toFixed(2)}px`;
    const skyOpacity = (opacity * skyAmount).toFixed(3);
    const sceneOpacity = opacity.toFixed(3);
    const { sky, scene } = layers;
    if (transform !== written.transform) sky.style.transform = written.transform = transform;
    if (width !== written.width) sky.style.width = written.width = width;
    if (height !== written.height) sky.style.height = written.height = height;
    if (skyOpacity !== written.skyOpacity) sky.style.opacity = written.skyOpacity = skyOpacity;
    if (sceneOpacity !== written.sceneOpacity) {
      scene.style.opacity = written.sceneOpacity = sceneOpacity;
    }
  }

  function tick(now: number): void {
    raf = 0;
    if (!started) started = now;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;

    const state = useWorldStore.getState();
    const stage = (state.activeStageId && state.stages[state.activeStageId]) || null;
    const reduced =
      state.motion === 'reduced' || (state.motion === 'system' && reducedQuery.matches);

    // 1. READ. Everything is measured against the canvas rectangle of this very frame,
    //    which makes the mapping immune to mobile URL bars, overscroll and pinch zoom.
    const canvasRect = layers.backdrop.getBoundingClientRect();
    frame.canvas.width = Math.max(1, canvasRect.width);
    frame.canvas.height = Math.max(1, canvasRect.height);
    let target: Box | null = null;
    if (stage) {
      const rect = stage.el.getBoundingClientRect();
      // A hidden (`display: none`) or collapsed stage has no box to stand in.
      if (rect.width >= 2 && rect.height >= 2) {
        target = {
          x: rect.left - canvasRect.left,
          y: rect.top - canvasRect.top,
          width: rect.width,
          height: rect.height,
        };
      }
    }

    // 2. PLACE.
    const { box } = frame;
    let dipOpacity = 1;
    if (stage && target) {
      absentMs = 0;
      const options = stage.options;
      const wantsSky = options.sky ? 1 : 0;
      const wantsAnchor = options.anchor === 'bottom' ? 1 : 0;
      const fresh = !placed || presence < 0.04;
      const changed = stage.id !== stageId;
      if (fresh) {
        // First appearance: nothing to fly from, so pop in where the stage is.
        for (const spring of Object.values(offset)) Object.assign(spring, rest());
        Object.assign(blend, rest());
        appear.x = reduced ? 0 : 1;
        appear.v = 0;
        dip = null;
        placed = true;
      } else if (changed) {
        if (reduced) {
          dip = { box: { ...box }, fit: shown.fit, anchor: shown.anchor, sky: shown.sky, t: 0 };
          for (const spring of Object.values(offset)) Object.assign(spring, rest());
          Object.assign(blend, rest());
        } else {
          // FLIP: the jump becomes an offset that springs back to zero. Velocities are
          // kept, so retargeting mid-flight stays smooth. Sizes fly in log space.
          offset.cx.x = box.x + box.width / 2 - (target.x + target.width / 2);
          offset.cy.x = box.y + box.height / 2 - (target.y + target.height / 2);
          offset.w.x = Math.log(Math.max(1, box.width) / target.width);
          offset.h.x = Math.log(Math.max(1, box.height) / target.height);
          Object.assign(from, shown);
          blend.x = 1;
          blend.v = 0;
          carry = Math.min(1, Math.hypot(offset.cx.x, offset.cy.x) / 200);
        }
      }
      if (fresh || changed) {
        stageId = stage.id;
        const radius = getComputedStyle(stage.el).borderRadius;
        if (radius !== written.radius) layers.sky.style.borderRadius = written.radius = radius;
        // A companion stage with a sky is a printed plate; the others bleed to the edges.
        layers.sky.dataset.frame = options.mode === 'companion' ? 'plate' : 'bleed';
      }

      // While the stage stays the same every offset is at rest, so the box IS the
      // stage rectangle: no easing on scroll or resize, or it would swim against the page.
      for (const spring of Object.values(offset)) {
        stepSpring(spring, dt, MOTION.flightOmega, MOTION.flightZeta);
      }
      stepSpring(blend, dt, MOTION.flightOmega, 1);
      const width = target.width * Math.exp(offset.w.x);
      const height = target.height * Math.exp(offset.h.x);
      // Peel, carry, press: mid-flight the sticker is off the page and rides a shallow arc.
      const k = Math.min(1, Math.max(0, blend.x));
      frame.lift = 4 * k * (1 - k) * carry;
      box.x = target.x + target.width / 2 + offset.cx.x - width / 2;
      box.y =
        target.y + target.height / 2 + offset.cy.x - height / 2 - MOTION.flightArc * frame.lift;
      box.width = width;
      box.height = height;
      shown.fit = options.fit + (from.fit - options.fit) * blend.x;
      shown.anchor = wantsAnchor + (from.anchor - wantsAnchor) * blend.x;
      shown.sky = wantsSky + (from.sky - wantsSky) * blend.x;
      frame.mode = options.mode;
      frame.velocityX = offset.cx.v;
      frame.velocityY = offset.cy.v;
      frame.flying = offset.cx.x !== 0 || offset.cy.x !== 0 || offset.w.x !== 0 || offset.h.x !== 0;

      if (dip) {
        dip.t += (dt * 1000) / MOTION.crossFadeMs;
        if (dip.t >= 1) {
          dip = null;
        } else if (dip.t < 0.5) {
          Object.assign(box, dip.box);
          shown.fit = dip.fit;
          shown.anchor = dip.anchor;
          shown.sky = dip.sky;
          dipOpacity = 1 - dip.t * 2;
        } else {
          dipOpacity = dip.t * 2 - 1;
        }
      }
      presence = Math.min(1, presence + dt * 14 + (dt === 0 ? 0.05 : 0));
    } else {
      // No stage (or a collapsed one): hold the last box and, after a short grace for
      // lazy routes, fade out.
      absentMs += dt * 1000;
      if (absentMs > MOTION.graceMs) {
        presence = Math.max(0, presence - dt * MOTION.fadeOutPerSecond);
      }
      frame.velocityX = 0;
      frame.velocityY = 0;
      frame.flying = false;
      frame.lift = 0;
    }
    stepSpring(appear, dt, MOTION.appearOmega, MOTION.appearZeta);

    // 3. SKY. Follows the hour of whatever the active stage previews.
    if (cachedSnapshot !== state.snapshot || cachedPreview !== (stage?.options.preview ?? null)) {
      cachedSnapshot = state.snapshot;
      cachedPreview = stage?.options.preview ?? null;
      merged = cachedPreview ? { ...state.snapshot, ...cachedPreview } : state.snapshot;
    }
    if (!(Math.abs(merged.hour - skyHour) < 0.004)) {
      skyHour = merged.hour;
      const sky = skyAt(skyHour);
      applySkyVars(document.documentElement, sky);
      applySkyVars(layers.backdrop, sky);
    }

    const opacity = presence * dipOpacity;
    frame.time = (now - started) / 1000;
    frame.dt = dt;
    frame.fit = shown.fit;
    frame.anchor = shown.anchor;
    frame.opacity = opacity;
    frame.appear = 1 - (1 - MOTION.appearFrom) * appear.x;
    frame.reducedMotion = reduced;
    frame.snapshot = merged;
    frame.stage = stage;
    frame.render = placed && opacity > 0.002 && boxesIntersect(box, frame.canvas, 96);
    writeLayers(opacity, shown.sky);

    // 4. RENDER, in the same task as the reads.
    listeners.forEach((listener) => listener(frame));

    // Keep ticking while there is something to follow or to fade.
    if (Object.keys(state.stages).length > 0 || presence > 0) schedule();
  }

  const wake = () => {
    if (!raf) last = 0;
    schedule();
  };
  wakeTracker = wake;
  const pop = () => {
    const { motion } = useWorldStore.getState();
    if (motion === 'reduced' || (motion === 'system' && reducedQuery.matches)) return;
    appear.x = 1;
    appear.v = 0;
  };
  replayAppear = pop;
  const unsubscribe = useWorldStore.subscribe(wake);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('resize', wake);
  wake();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (wakeTracker === wake) wakeTracker = null;
    if (replayAppear === pop) replayAppear = null;
    unsubscribe();
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('resize', wake);
  };
}
