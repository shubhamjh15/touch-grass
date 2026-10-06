import type { BurstKind } from '../pulses';

/**
 * The one way to throw loose bits (leaves, petals, confetti, drops, dust) into the world.
 * The `<Bursts>` pool registers itself here; anything in the scene may call `spawnBurst`.
 */
export type Spawner = (
  kind: BurstKind,
  count: number,
  at?: readonly [number, number, number],
) => void;

let spawner: Spawner | null = null;

/** Called by the particle pool when it mounts. Returns the undo. */
export function registerSpawner(spawn: Spawner): () => void {
  spawner = spawn;
  return () => {
    if (spawner === spawn) spawner = null;
  };
}

/**
 * Throws `count` bits of a kind. Without `at` they start where that kind belongs (the
 * crown, the foot of the tree, the rim); with it, at that point of island space.
 */
export function spawnBurst(
  kind: BurstKind,
  count: number,
  at?: readonly [number, number, number],
): void {
  spawner?.(kind, count, at);
}
