import type { ReactNode } from 'react';

/**
 * Public contract of the Grove — the single persistent 3D world behind the app.
 *
 * The world never knows about the game: it renders a {@link WorldSnapshot}, reacts
 * to {@link WorldPulse}s and positions itself inside whichever `<WorldStage>` is
 * active. Everything else in the app talks to the world only through `@/world`.
 */

/** Tree species a user can grow. Each has a distinct silhouette and palette. */
export const SPECIES = ['oak', 'cherry', 'pine'] as const;
export type Species = (typeof SPECIES)[number];

/** Island features unlocked through play. The scene renders the ones listed in the snapshot. */
export const ISLAND_PROPS = [
  'flowers',
  'mushrooms',
  'pond',
  'bench',
  'lantern',
  'turbine',
  'solar',
  'compost',
  'veggie-patch',
  'beehive',
  'birdhouse',
  'birds',
  'butterflies',
  'fireflies',
  'swing',
  'signpost',
] as const;
export type IslandPropId = (typeof ISLAND_PROPS)[number];

/** Everything the scene needs to draw the user's world. Derived from game state. */
export interface WorldSnapshot {
  /** Stable per user. Drives every procedural choice so a tree always looks like itself. */
  seed: number;
  species: Species;
  /** 0..1 maturity of the tree. Monotonic: a tree never shrinks. */
  growth: number;
  /** 0..1 health. 1 = thriving, ~0.5 = thirsty, 0 = dormant. Affects colour and droop only. */
  vitality: number;
  /** Growth rings: number of days the user has shown up. */
  ageDays: number;
  /** Unlocked island features. */
  props: readonly IslandPropId[];
  /** Local time of day, 0..24 (fractional). Drives sky and light. */
  hour: number;
}

export const DEFAULT_SNAPSHOT: WorldSnapshot = {
  seed: 1,
  species: 'oak',
  growth: 0,
  vitality: 1,
  ageDays: 0,
  props: [],
  hour: 12,
};

/**
 * How the world behaves inside a stage.
 * - `hero`: large, cinematic, slow idle orbit (landing, onboarding preview).
 * - `hub`: the app home. Interactive, can show landmark hotspots.
 * - `companion`: small and calm next to content. Not interactive by default.
 * - `ceremony`: centre stage for one-off moments (planting the seed, level-up).
 */
export type StageMode = 'hero' | 'hub' | 'companion' | 'ceremony';

/** Navigation hotspots that live on the island in `hub` mode. */
export const LANDMARKS = ['log', 'quests', 'learn', 'impact', 'community', 'coach', 'me'] as const;
export type LandmarkId = (typeof LANDMARKS)[number];

/** One-shot visual reactions. Fire with `emitPulse()`; the scene plays them and forgets. */
export type WorldPulse =
  /** An action was logged: leaves pop. `strength` 0..1 scales the burst. */
  | { kind: 'grow'; strength?: number }
  /** First show-up of the day: the tree gains a ring. */
  | { kind: 'ring' }
  /** The user came back to a thirsty or dormant tree. */
  | { kind: 'water' }
  | { kind: 'level-up'; level: number }
  | { kind: 'badge' }
  | { kind: 'streak'; days: number }
  /** Seed-planting ceremony at the end of onboarding. */
  | { kind: 'plant' }
  | { kind: 'celebrate' };

export interface WorldStageProps {
  /** Default: `companion`. */
  mode?: StageMode;
  /**
   * Overrides parts of the live snapshot while this stage is active, e.g. to preview a
   * species during onboarding or to scrub growth on the landing page. Values are eased.
   */
  preview?: Partial<WorldSnapshot>;
  /** Drag to orbit. Default: true for `hero` and `hub`, false otherwise. */
  interactive?: boolean;
  /** Show landmark hotspots as focusable buttons tracked to the island. Default: false. */
  landmarks?: boolean;
  onLandmark?: (id: LandmarkId) => void;
  /** Portion (0..1) of the stage box the island may fill. Default: 0.86. */
  fit?: number;
  /** Where the island sits inside the box. Default: `bottom`. */
  anchor?: 'center' | 'bottom';
  /** When several stages are visible the highest priority wins; ties go to the most visible. */
  priority?: number;
  /** Text alternative for the scene, e.g. "Juniper, a 12-day-old oak sapling, thriving". */
  label?: string;
  className?: string;
  /** DOM overlays positioned inside the stage box (captions, chips). */
  children?: ReactNode;
}

/**
 * - `idle`: nothing mounted yet.
 * - `loading`: the 3D chunk is downloading or compiling.
 * - `ready`: the 3D scene has rendered at least one frame.
 * - `fallback`: 3D is unavailable or turned off; stages show the illustrated tree instead.
 */
export type WorldStatus = 'idle' | 'loading' | 'ready' | 'fallback';

export type WorldQuality = 'low' | 'medium' | 'high';

/** User preference for 3D. `auto` picks a quality tier from the device and degrades if needed. */
export type WorldPreference = 'auto' | WorldQuality | 'off';
