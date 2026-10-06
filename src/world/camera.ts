import { clamp, clamp01, lerp } from '@/lib/math';
import type { StageMode } from './contract';

/**
 * Where the camera stands for a stage: pure maths, shared by the scene and the tests.
 *
 * The rule the whole remake hangs on: **the tree is always large**. A sprout is framed
 * close up among the grass; as the tree grows the camera pulls back just far enough to
 * keep the crown in view, and only an elder tree shows the whole island with its rock
 * underside. The frame is an eased function of growth (never the live bounding box), so
 * the picture glides instead of jumping when a branch pops in.
 */

/** Vertical field of view of the world camera, in degrees. */
export const FOV = 30;

/** The tree's own geometry is drawn this many times larger than its skeleton units. */
export const TREE_SCALE = 1.12;

const deg = (value: number) => (value * Math.PI) / 180;

interface ModeView {
  /** Elevation of the camera above the horizon. */
  pitch: number;
  /** Half-width of the framed box around a seed, and the least it is for an elder. */
  youngHalf: number;
  elderHalf: number;
  /** How far below the lawn the frame reaches, young and elder. */
  youngBelow: number;
  elderBelow: number;
  /** Air kept above the crown. */
  headroom: number;
  /** The least height above the lawn that is framed, so a seed is not lost in the grass. */
  minTop: number;
}

export const VIEW: Record<StageMode, ModeView> = {
  hero: {
    pitch: deg(13),
    youngHalf: 2.25,
    elderHalf: 3.7,
    youngBelow: 1.25,
    elderBelow: 3.25,
    headroom: 0.55,
    minTop: 1.5,
  },
  hub: {
    pitch: deg(15),
    youngHalf: 1.75,
    elderHalf: 3.5,
    youngBelow: 0.6,
    elderBelow: 1.7,
    headroom: 0.45,
    minTop: 1.35,
  },
  companion: {
    pitch: deg(13),
    youngHalf: 1.3,
    elderHalf: 3.35,
    youngBelow: 0.45,
    elderBelow: 1.25,
    headroom: 0.3,
    minTop: 1.15,
  },
  ceremony: {
    pitch: deg(21),
    youngHalf: 1.25,
    elderHalf: 3.4,
    youngBelow: 0.45,
    elderBelow: 1.4,
    headroom: 0.5,
    minTop: 1.3,
  },
};

export interface ViewInput {
  mode: StageMode;
  /** Width over height of the stage. */
  aspect: number;
  /** Share of the stage width the framed box may take (the stage's `fit`). */
  fit: number;
  /** 0 = the box is centred in the stage, 1 = it stands on the stage's bottom edge. */
  anchor: number;
  growth: number;
  /** Top of the tree above the lawn and its widest reach, in world units, at this growth. */
  treeTop: number;
  treeHalfWidth: number;
  /** Where the trunk stands. */
  treeX: number;
  treeZ: number;
}

export interface View {
  targetX: number;
  targetY: number;
  targetZ: number;
  distance: number;
  pitch: number;
  /** World units the frame spans vertically at the target. */
  span: number;
}

/** 0..1 eased share of the elder frame in use at `growth`. Monotonic. */
export function frameShare(growth: number): number {
  return 1 - (1 - clamp01(growth)) ** 1.7;
}

export function viewFor(input: ViewInput, out: View): View {
  const view = VIEW[input.mode];
  const share = frameShare(input.growth);
  const half = Math.max(lerp(view.youngHalf, view.elderHalf, share), input.treeHalfWidth + 0.35);
  const top = Math.max(input.treeTop + view.headroom, view.minTop);
  const below = lerp(view.youngBelow, view.elderBelow, share);

  // What the box measures on screen from the pitched camera: its height shrinks a
  // little, and the depth of the island adds some.
  const tall = (top + below) * Math.cos(view.pitch) + half * 0.9 * Math.sin(view.pitch);
  const tan = Math.tan(deg(FOV) / 2);
  const aspect = clamp(input.aspect, 0.3, 4);
  const fit = clamp(input.fit, 0.2, 1);
  const forHeight = tall / 2 / tan / 0.95;
  const forWidth = half / (tan * aspect) / fit;
  const distance = Math.max(forHeight, forWidth);
  const span = 2 * distance * tan;

  const centred = (top - below) / 2;
  // Standing on the bottom edge: the lowest framed point sits just above the stage's edge.
  const grounded = -below + (span / 2) * 0.97;
  out.targetX = input.treeX;
  out.targetY = lerp(centred, Math.max(centred, grounded), clamp01(input.anchor));
  out.targetZ = input.treeZ * 0.4;
  out.distance = distance;
  out.pitch = view.pitch;
  out.span = span;
  return out;
}
