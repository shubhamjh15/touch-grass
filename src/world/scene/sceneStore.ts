import { useEffect } from 'react';
import { create } from 'zustand';
import type { Species, StageMode } from '../contract';

/**
 * The few facts about the scene that *do* re-render React: which tree to build, whether
 * the sky is drawn, which stage mode is active. The director writes them only when they
 * change; everything that moves every frame lives in `live.ts` instead.
 */
interface SceneState {
  seed: number;
  species: Species;
  /** The active stage wants the painted sky behind the island (otherwise the canvas is clear). */
  sky: boolean;
  mode: StageMode;
}

export const useScene = create<SceneState>()(() => ({
  seed: 1,
  species: 'oak',
  sky: true,
  mode: 'companion',
}));

/** Frees a GPU resource when it is replaced or its owner unmounts. */
export function useDispose(resource: { dispose: () => void }): void {
  useEffect(() => () => resource.dispose(), [resource]);
}
