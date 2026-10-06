'use client';

import { WorldStage } from '@/world';
import { HERO } from './copy';

/** A grown oak: what a visitor's own tree becomes. Fixed, so every visitor sees the same picture. */
const HERO_TREE = {
  seed: 12,
  species: 'oak',
  growth: 0.62,
  vitality: 1,
  ageDays: 120,
  props: [],
} as const;

/**
 * The hero's illustrated tree. The box has its size in CSS, so the server HTML already
 * reserves the space and nothing shifts when the illustration arrives.
 */
export function HeroTree() {
  return (
    <WorldStage
      mode="hero"
      interactive={false}
      preview={HERO_TREE}
      label={HERO.treeLabel}
      className="h-[300px] w-full lg:h-[400px]"
    />
  );
}
