// Public API of the Grove. Import from `@/world`, never from the files inside it.
export { WorldCanvas } from './WorldCanvas';
export { WorldStage } from './WorldStage';
export {
  captureWorld,
  emitPulse,
  getStickingPoint,
  getWorldStats,
  measureWorld,
  setWorldSnapshot,
  useWorldStore,
} from './store';
export type { WorldStats } from './store';
export { onWorldHover, onWorldTap } from './interaction';
export type { WorldHit } from './interaction';
export { anchorsFor } from './anchors';
export type { Anchor, AnchorId } from './anchors';
export { terrainHeight } from './terrain';
export { DEFAULT_SNAPSHOT, ISLAND_PROPS, LANDMARKS, SPECIES } from './contract';
export type {
  IslandPropId,
  LandmarkId,
  Species,
  StageMode,
  WorldMotion,
  WorldPreference,
  WorldPulse,
  WorldQuality,
  WorldSnapshot,
  WorldStageProps,
  WorldStatus,
} from './contract';
