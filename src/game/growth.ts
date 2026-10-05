/**
 * Growth points to the tree. A fixed table with linear interpolation and an asymptotic
 * tail: visible on the first action, still growing in year three, never complete.
 */
import { clamp } from '@/lib/math';
import { GROWTH_TABLE, STAGES } from './economy';

export type StageName = (typeof STAGES)[number][0];

const LAST_ANCHOR = GROWTH_TABLE[GROWTH_TABLE.length - 1];
const TAIL_GP = LAST_ANCHOR[0];
const TAIL_GROWTH = LAST_ANCHOR[1];

/** The 0..1 growth value handed to the world. Strictly increasing, never 1. */
export function growthOf(gp: number): number {
  const points = Math.max(0, gp);
  if (points >= TAIL_GP) return 1 - ((1 - TAIL_GROWTH) * TAIL_GP) / points;
  for (let index = 1; index < GROWTH_TABLE.length; index += 1) {
    const [x1, y1] = GROWTH_TABLE[index] as readonly [number, number];
    if (points <= x1) {
      const [x0, y0] = GROWTH_TABLE[index - 1] as readonly [number, number];
      return y0 + ((points - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return TAIL_GROWTH;
}

/** Index into `STAGES` of the stage a tree with `gp` points is in. */
export function stageIndexOf(gp: number): number {
  let index = 0;
  for (let i = 0; i < STAGES.length; i += 1) {
    if (gp >= (STAGES[i] as (typeof STAGES)[number])[1]) index = i;
  }
  return index;
}

export function stageName(index: number): StageName {
  const safe = clamp(Math.floor(index), 0, STAGES.length - 1);
  return (STAGES[safe] as (typeof STAGES)[number])[0];
}

export function stageOf(gp: number): StageName {
  return stageName(stageIndexOf(gp));
}

/** 0..1 through the current stage. The last stage approaches 1 and never arrives. */
export function stageProgress(gp: number): number {
  const index = stageIndexOf(gp);
  const min = (STAGES[index] as (typeof STAGES)[number])[1];
  const next = STAGES[index + 1];
  if (!next) return gp <= 0 ? 0 : 1 - min / Math.max(gp, min);
  return clamp((gp - min) / (next[1] - min), 0, 1);
}

export interface GrowthInfo {
  gp: number;
  growth: number;
  stage: StageName;
  stageIndex: number;
  /** `null` once the tree is Ancient. */
  nextStage: StageName | null;
  stageProgress: number;
  /** Growth points still missing for the next stage; `null` once Ancient. */
  gpToNextStage: number | null;
}

export function growthInfo(gp: number): GrowthInfo {
  const points = Math.max(0, gp);
  const index = stageIndexOf(points);
  const next = STAGES[index + 1];
  return {
    gp: points,
    growth: growthOf(points),
    stage: stageName(index),
    stageIndex: index,
    nextStage: next ? next[0] : null,
    stageProgress: stageProgress(points),
    gpToNextStage: next ? next[1] - points : null,
  };
}

/** Strength of the world's `grow` pulse for a saved log: 3 to 8 fresh leaves whatever the tree's size. */
export function growPulseStrength(logGp: number): number {
  return clamp(logGp / 5, 0.2, 1);
}

/** "Sapling → Young tree 43.2%": one decimal, so a single act always changes the number. */
export function stageProgressLabel(gp: number): string {
  const info = growthInfo(gp);
  const percent = (Math.floor(info.stageProgress * 1000) / 10).toFixed(1);
  return info.nextStage
    ? `${info.stage} → ${info.nextStage} ${percent}%`
    : `${info.stage} ${percent}%`;
}
