import * as THREE from 'three';
import { atmosphereAt, moodAt, type Atmosphere, type Mood } from '../atmosphere';
import type { Species, StageMode, WorldQuality } from '../contract';
import { createChannels, type PulseChannels } from '../pulses';
import { createTerrain, type Terrain } from '../terrain';

/**
 * The state of the world this frame, shared by every part of the scene.
 *
 * It is written once per frame by the director (`Director.tsx`) before anything draws,
 * and read by the parts in their own `useFrame`. Nothing here is React state: a value
 * that changes every frame must never cause a render.
 */
export interface Live {
  /** Seconds since the tracker started, and since the previous drawn frame. */
  time: number;
  dt: number;
  /** Reduced motion: no camera moves, no bursts, a slow sway only. */
  reduced: boolean;
  mode: StageMode;
  quality: WorldQuality;
  species: Species;
  seed: number;
  ageDays: number;
  /** Growth, vitality and hour on screen: the snapshot's values, eased. */
  growth: number;
  vitality: number;
  hour: number;
  /** 0..1: how fast growth is moving right now. New parts overshoot while it is above 0. */
  growing: number;
  atmosphere: Atmosphere;
  mood: Mood;
  terrain: Terrain;
  /** What the pulses ask of the scene this frame. */
  channels: PulseChannels;
  /** Camera orbit from the stage (idle motion, drag, keys, pointer parallax), radians. */
  yaw: number;
  tilt: number;
  /** Scale of the first-appearance pop: settles at 1. */
  appear: number;
  /** The tree as drawn: where it stands, how tall and wide it is in world units. */
  tree: { x: number; y: number; z: number; top: number; halfWidth: number };
  /** 0..1 shake of the crown after a tap; decays by itself. */
  shake: number;
  /** Name of the part under the pointer, or `null`. */
  hover: string | null;
  /** Width over height of the canvas. */
  aspect: number;
  /**
   * When a part (`prop:bench`) joined the island, in scene seconds: it drops in from
   * then. Parts that were there when the world loaded are not listed.
   */
  arrived: Map<string, number>;
  /** When a part was last tapped, in scene seconds. */
  tapped: Map<string, number>;
  /** 0..1: creatures were startled just now; decays by itself. */
  startle: number;
  /** Where the last tap or startle happened, in island space. */
  startleAt: [number, number, number];
  /** The active stage is the full-screen Explore view. */
  explore: boolean;
}

export const live: Live = {
  time: 0,
  dt: 0,
  reduced: false,
  mode: 'companion',
  quality: 'medium',
  species: 'oak',
  seed: 1,
  ageDays: 0,
  growth: 0,
  vitality: 1,
  hour: 12,
  growing: 0,
  atmosphere: atmosphereAt(12),
  mood: moodAt(1),
  terrain: createTerrain(1),
  channels: createChannels(),
  yaw: 0,
  tilt: 0,
  appear: 1,
  tree: { x: 0, y: 0, z: 0, top: 1, halfWidth: 0.5 },
  shake: 0,
  hover: null,
  aspect: 1,
  arrived: new Map(),
  tapped: new Map(),
  startle: 0,
  startleAt: [0, 0, 0],
  explore: false,
};

/**
 * Uniforms shared by every patched material (see `materials.ts`). One object per
 * uniform, referenced by all programs, so the director updates each value once a frame.
 */
export const shared = {
  uTime: { value: 0 },
  /** Wind direction on the ground plane (x, z), strength and gust phase. */
  uWind: { value: new THREE.Vector4(0.86, 0.5, 1, 0) },
  /** Foot of the tree (xyz) and its height: sway grows with the height above the foot. */
  uTree: { value: new THREE.Vector4(0, 0, 0, 1) },
  /** Dryness, cold. */
  uMood: { value: new THREE.Vector2(0, 0) },
  /** 0..1 wash of light over the foliage (pulses). */
  uFlash: { value: 0 },
  /** A ripple through the grass: centre x, centre z, seconds since it started, strength. */
  uRipple: { value: new THREE.Vector4(0, 0, 99, 0) },
  /** 0..1 droop of leaves. */
  uDroop: { value: 0 },
  /** 0..1 shake of the crown. */
  uShake: { value: 0 },
  /**
   * Where the crown's shadow falls on the lawn: centre x, centre z, radius, strength.
   * Grass and flowers shade themselves from it instead of sampling the shadow map.
   */
  uCrown: { value: new THREE.Vector4(0, 0, 1, 0) },
};

/** Sets a three colour from an sRGB triple in 0..1 (converted to the linear working space). */
export function setColor(target: THREE.Color, rgb: readonly [number, number, number]): THREE.Color {
  return target.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}
