import { ISLAND_PROPS, LANDMARKS, type IslandPropId, type LandmarkId } from '../contract';

/**
 * Props and landmark objects share one mesh. What lets a single mesh arrive, wiggle,
 * spin and blink part by part is the *slot*: an index every vertex carries, and a pose
 * (scale, lift, roll, stretch) per slot that the vertex shader applies about a pivot.
 * Slot 0 is the identity and is never animated.
 */
export const SLOT_COUNT = 32;

export const SLOT = {
  none: 0,
  /** 1..16: the island props, in contract order. */
  props: 1,
  /** 17..23: the landmark objects, in contract order. */
  landmarks: 1 + ISLAND_PROPS.length,
  blades: 24,
  ripple: 25,
  flowerHeads: 26,
  mossEyes: 27,
  mossSprout: 28,
  steam: 29,
  lanternDisc: 30,
  swingSeat: 31,
} as const;

export const propSlot = (id: IslandPropId): number => SLOT.props + ISLAND_PROPS.indexOf(id);
export const landmarkSlot = (id: LandmarkId): number => SLOT.landmarks + LANDMARKS.indexOf(id);
