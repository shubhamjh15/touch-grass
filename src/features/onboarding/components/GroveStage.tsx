'use client';

import { Tag } from '@/ui';
import { WorldStage, type WorldSnapshot } from '@/world';
import { SPECIES_COPY } from '../copy';
import { cleanTreeName, type OnboardingDraft, type ScreenId } from '../flow';

/** How grown the preview tree is: a young tree, a few months of showing up. */
export const PREVIEW_GROWTH = 0.6;

/** Screens that still show the bare island: the tree has not been chosen yet. */
const BARE: readonly ScreenId[] = ['legacy', 'promise', 'you'];

export function stagePreview(screen: ScreenId, draft: OnboardingDraft): Partial<WorldSnapshot> {
  if (BARE.includes(screen)) {
    return { species: draft.species, growth: 0, vitality: 1, ageDays: 0, props: [] };
  }
  return { species: draft.species, growth: PREVIEW_GROWTH, vitality: 1, ageDays: 0, props: [] };
}

export function stageLabel(screen: ScreenId, draft: OnboardingDraft): string {
  if (BARE.includes(screen)) return 'A small floating island with a seed waiting in the soil.';
  const name = cleanTreeName(draft.treeName);
  const species = SPECIES_COPY[draft.species].noun;
  return name
    ? `A preview of ${name}, your ${species}, as a young tree.`
    : `A preview of your ${species} as a young tree.`;
}

export interface GroveStageProps {
  screen: ScreenId;
  draft: OnboardingDraft;
  className?: string;
}

/**
 * The stage of every screen before the ceremony: the bare island first, then a preview of
 * the chosen species once there is a tree to talk about. The hang tag follows the name field
 * letter by letter, and says plainly that this is a preview.
 */
export function GroveStage({ screen, draft, className }: GroveStageProps) {
  const bare = BARE.includes(screen);
  const name = cleanTreeName(draft.treeName);

  return (
    <WorldStage
      mode="hero"
      // A bare island has no tree to fill the box, so it is shown whole, with its seed spot.
      fit={bare ? 0.62 : undefined}
      anchor={bare ? 'center' : undefined}
      preview={stagePreview(screen, draft)}
      label={stageLabel(screen, draft)}
      className={className}
    >
      <div className="pointer-events-none absolute bottom-7 left-3 z-10 lg:bottom-12 lg:left-12">
        {bare ? (
          <Tag hue="paper" className="-rotate-2 shadow-1">
            Unplanted
          </Tag>
        ) : (
          <Tag
            variant="specimen"
            title={name || '…'}
            meta={`${SPECIES_COPY[draft.species].noun} · preview`}
            className="max-w-[min(70vw,320px)] animate-stick"
          />
        )}
      </div>
    </WorldStage>
  );
}
