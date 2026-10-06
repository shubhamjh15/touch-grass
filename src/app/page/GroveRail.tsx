'use client';

import { useTreeStatus } from '@/game';
import { formatNumber } from '@/lib/format';
import { Tag, TextLink } from '@/ui';
import { WorldStage } from '@/world';
import { ROUTES } from '../routes';

/**
 * The left rail of every app route except Today (`lg` and up): the grove as a printed plate, its
 * hang tag and one line of status. Because it never unmounts between rail routes, moving from
 * Log to Quests leaves the tree exactly where it is, and Today to anything is a short carry.
 */
export function GroveRail() {
  const tree = useTreeStatus();
  const meta = [tree.species, tree.stage, `day ${formatNumber(tree.dayNumber)}`, tree.vitalityLabel]
    .join(' · ')
    .toUpperCase();

  return (
    <aside aria-label="Your grove" className="sticky top-28 grid gap-3">
      <WorldStage mode="companion" sky label={tree.sceneLabel} className="aspect-[11/12] w-full" />
      <Tag
        variant="specimen"
        title={tree.name}
        meta={meta}
        href={ROUTES.me}
        className="relative z-(--z-content) -mt-9 ml-3 -rotate-3 justify-self-start"
      />
      <p className="text-body-sm text-ink-2">{tree.statusLine}</p>
      <TextLink href={ROUTES.today} className="justify-self-start text-body-sm font-semibold">
        Back to the grove
      </TextLink>
    </aside>
  );
}
