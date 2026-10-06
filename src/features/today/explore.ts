/**
 * Explore mode belongs to the world: full screen, a camera that flies in, labelled landmarks,
 * a photo button. The world publishes it from `@/world` while it is being remade, so this
 * page asks the barrel at run time instead of importing a name that may not exist yet.
 * Until it does, Today falls back to its own smaller version: a taller stage with the
 * landmarks and two turn buttons.
 */
import * as World from '@/world';

/** The names the world may publish its "open Explore" function under, most likely first. */
const OPEN_NAMES = ['openExplore', 'enterExplore', 'startExplore'] as const;

/** The world's own Explore mode, or `null` while `@/world` does not export one. */
export function worldExplore(): (() => void) | null {
  const exports = World as unknown as Record<string, unknown>;
  for (const name of OPEN_NAMES) {
    // `in` first: reading a missing export from a mocked module throws in tests.
    if (!(name in exports)) continue;
    const open = exports[name];
    if (typeof open === 'function') return () => void (open as () => unknown)();
  }
  return null;
}
