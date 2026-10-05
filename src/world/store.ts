import { create } from 'zustand';
import {
  DEFAULT_SNAPSHOT,
  type LandmarkId,
  type StageMode,
  type WorldMotion,
  type WorldPreference,
  type WorldPulse,
  type WorldQuality,
  type WorldSnapshot,
  type WorldStatus,
} from './contract';

/** Stage options after defaults are applied. */
export interface StageOptions {
  mode: StageMode;
  preview: Partial<WorldSnapshot> | null;
  interactive: boolean;
  landmarks: boolean;
  onLandmark: ((id: LandmarkId) => void) | null;
  fit: number;
  anchor: 'center' | 'bottom';
  priority: number;
  /** Whether the printed sky is drawn inside this stage box. */
  sky: boolean;
}

export interface StageRecord {
  id: string;
  el: HTMLElement;
  options: StageOptions;
  /** Fraction of the stage box currently inside the viewport, 0..1. */
  visible: number;
  /** Registration order; later stages win ties. */
  order: number;
}

interface WorldState {
  status: WorldStatus;
  preference: WorldPreference;
  quality: WorldQuality;
  /** App-level motion setting. `system` follows the OS "reduce motion" preference. */
  motion: WorldMotion;
  snapshot: WorldSnapshot;
  stages: Record<string, StageRecord>;
  activeStageId: string | null;

  registerStage: (id: string, el: HTMLElement, options: StageOptions) => void;
  updateStage: (id: string, options: StageOptions) => void;
  setStageVisibility: (id: string, visible: number) => void;
  unregisterStage: (id: string) => void;
  setSnapshot: (patch: Partial<WorldSnapshot>) => void;
  setStatus: (status: WorldStatus) => void;
  setPreference: (preference: WorldPreference) => void;
  setQuality: (quality: WorldQuality) => void;
  setMotion: (motion: WorldMotion) => void;
}

let registrations = 0;

/**
 * The stage the world should occupy: highest priority first, then the most visible,
 * then the most recently mounted. A stage that scrolled off screen keeps the world
 * (so it follows the page) until another visible stage claims it.
 */
function pickActiveStage(
  stages: Record<string, StageRecord>,
  current: string | null,
): string | null {
  const all = Object.values(stages);
  if (all.length === 0) return null;
  const visible = all.filter((stage) => stage.visible > 0);
  if (visible.length === 0) return current && stages[current] ? current : (all.at(-1)?.id ?? null);
  visible.sort(
    (a, b) => b.options.priority - a.options.priority || b.visible - a.visible || b.order - a.order,
  );
  return visible[0]?.id ?? null;
}

export const useWorldStore = create<WorldState>()((set) => ({
  status: 'idle',
  preference: 'auto',
  quality: 'medium',
  motion: 'system',
  snapshot: DEFAULT_SNAPSHOT,
  stages: {},
  activeStageId: null,

  registerStage: (id, el, options) =>
    set((state) => {
      const stages = {
        ...state.stages,
        [id]: { id, el, options, visible: 0, order: ++registrations },
      };
      return { stages, activeStageId: pickActiveStage(stages, state.activeStageId) };
    }),

  updateStage: (id, options) =>
    set((state) => {
      const stage = state.stages[id];
      if (!stage) return state;
      const stages = { ...state.stages, [id]: { ...stage, options } };
      return { stages, activeStageId: pickActiveStage(stages, state.activeStageId) };
    }),

  setStageVisibility: (id, visible) =>
    set((state) => {
      const stage = state.stages[id];
      if (!stage || stage.visible === visible) return state;
      const stages = { ...state.stages, [id]: { ...stage, visible } };
      return { stages, activeStageId: pickActiveStage(stages, state.activeStageId) };
    }),

  unregisterStage: (id) =>
    set((state) => {
      if (!state.stages[id]) return state;
      const stages = { ...state.stages };
      delete stages[id];
      const current = state.activeStageId === id ? null : state.activeStageId;
      return { stages, activeStageId: pickActiveStage(stages, current) };
    }),

  setSnapshot: (patch) => set((state) => ({ snapshot: { ...state.snapshot, ...patch } })),
  setStatus: (status) => set({ status }),
  setPreference: (preference) => set({ preference }),
  setQuality: (quality) => set({ quality }),
  setMotion: (motion) => set({ motion }),
}));

/** Replace parts of the live snapshot. Called by the game bridge whenever game state changes. */
export function setWorldSnapshot(patch: Partial<WorldSnapshot>): void {
  useWorldStore.getState().setSnapshot(patch);
}

// --- Pulses: fire-and-forget events, kept out of React state on purpose. ---

type PulseListener = (pulse: WorldPulse) => void;
const pulseListeners = new Set<PulseListener>();

/** Ask the world to play a one-shot reaction. Safe to call when 3D is off (it is a no-op). */
export function emitPulse(pulse: WorldPulse): void {
  pulseListeners.forEach((listener) => listener(pulse));
}

/** Scene-side subscription. Returns an unsubscribe function. */
export function onPulse(listener: PulseListener): () => void {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

// --- Capture: lets the app export a picture of the world (share cards). ---

export interface CaptureOptions {
  /** Output size in CSS pixels. Default 1080 x 1080. */
  width?: number;
  height?: number;
}

type Capturer = (options: CaptureOptions) => Promise<Blob | null>;
let capturer: Capturer | null = null;

/** Scene-side registration of the function that renders a PNG of the world. */
export function registerCapturer(fn: Capturer | null): void {
  capturer = fn;
}

/** Renders the current world to a PNG. Resolves to `null` when 3D is unavailable. */
export function captureWorld(options: CaptureOptions = {}): Promise<Blob | null> {
  return capturer ? capturer(options) : Promise.resolve(null);
}

// --- Stats: what the renderer is doing, for the world lab and performance checks. ---

export interface WorldStats {
  /** Draw calls and triangles of the last rendered frame (`renderer.info`). */
  drawCalls: number;
  triangles: number;
  /** Smoothed frames per second and frame time of the render loop. */
  fps: number;
  frameMs: number;
  /** Device pixel ratio the canvas is actually rendering at. */
  dpr: number;
  /** Growth currently on screen (the snapshot value, eased). */
  growth: number;
  /** CSS pixels per world unit of the last placement. */
  scale: number;
  frames: number;
}

/** Mutated in place by the scene every frame; never React state. */
export const worldStats: WorldStats = {
  drawCalls: 0,
  triangles: 0,
  fps: 0,
  frameMs: 0,
  dpr: 1,
  growth: 0,
  scale: 0,
  frames: 0,
};

/** A copy of the live render statistics. All zeros while 3D is off. */
export function getWorldStats(): WorldStats {
  return { ...worldStats };
}
