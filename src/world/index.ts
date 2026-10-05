// Public API of the Grove. Import from `@/world`, never from the files inside it.
export { WorldCanvas } from './WorldCanvas';
export { WorldStage } from './WorldStage';
export { captureWorld, emitPulse, getWorldStats, setWorldSnapshot, useWorldStore } from './store';
export type { WorldStats } from './store';
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
