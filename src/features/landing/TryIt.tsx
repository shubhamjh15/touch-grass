'use client';

import { useMemo } from 'react';
import { Co2e, HonestyMark, Sticker } from '@/ui';
import { WorldStage, type WorldSnapshot } from '@/world';
import { TRY, demoTreeLabel } from './copy';
import { DEMO_ACTIONS, estimateFor, type DemoAction } from './model';
import { useDemo } from './useDemo';

/** The demo island is the same for every visitor: an oak, thriving, with nothing on the lawn. */
const DEMO_TREE = { seed: 12, species: 'oak', vitality: 1, props: [] } as const;

/** What the last sticker was worth: the same figure, mark and source the real log sheet shows. */
function Estimate({ action }: { action: DemoAction }) {
  const estimate = estimateFor(action);
  if (!estimate) {
    return (
      <>
        {action.label}: {TRY.noEstimate}.
      </>
    );
  }
  return (
    <>
      <span>{action.label}:</span>
      <HonestyMark source={estimate.source} size="sm" />
      <span>
        <span className="sr-only">approximately </span>
        {estimate.text} <Co2e explain /> {TRY.avoided}
      </span>
    </>
  );
}

/** What a screen reader hears after a tap: the figure and the tree's new stage, as one sentence. */
function announcement(action: DemoAction | null, stage: string): string {
  if (!action) return '';
  const estimate = estimateFor(action);
  const worth = estimate ? `approximately ${estimate.text} CO2e ${TRY.avoided}` : TRY.noEstimate;
  return `${action.label}: ${worth}. ${TRY.treeName}: ${stage}.`;
}

/**
 * Section 3 of the landing page: three action stickers and a demo tree that grows when one is
 * tapped. The tree is the stage's own illustration, driven through `preview`; this section
 * never reads or writes the saved game.
 */
export function TryIt() {
  const { taps, status, last, stick } = useDemo();
  const { growth, stage } = status;
  const preview = useMemo<Partial<WorldSnapshot>>(
    () => ({ ...DEMO_TREE, growth, ageDays: 2 + taps }),
    [growth, taps],
  );

  return (
    <section
      aria-labelledby="try-title"
      className="grid gap-x-14 gap-y-6 lg:grid-cols-2 lg:grid-rows-[1fr_auto_auto_1fr]"
    >
      <h2 id="try-title" className="text-h1 lg:col-start-2 lg:row-start-2">
        {TRY.title}
      </h2>

      <figure className="lg:col-start-1 lg:row-span-4 lg:row-start-1">
        <WorldStage
          mode="hero"
          interactive={false}
          priority={1}
          preview={preview}
          label={demoTreeLabel(stage)}
          className="h-[280px] w-full lg:h-[380px]"
        />
        <figcaption className="mt-3 text-center text-body font-semibold">
          {TRY.treeName} · {stage}
        </figcaption>
      </figure>

      <div className="lg:col-start-2 lg:row-start-3">
        <ul className="flex justify-between gap-3 sm:justify-start sm:gap-6">
          {DEMO_ACTIONS.map((action) => (
            <li key={action.id}>
              <Sticker
                category={action.category}
                label={action.label}
                size={96}
                rotate={0}
                onClick={() => stick(action)}
              />
            </li>
          ))}
        </ul>
        {/* Two lines are reserved, so the first estimate does not push the page down. */}
        <p className="mt-6 flex min-h-12 flex-wrap items-center gap-x-1.5 gap-y-1 text-body font-semibold">
          {last ? <Estimate action={last} /> : <span className="text-ink-2">{TRY.hint}</span>}
        </p>
        <p className="sr-only" role="status">
          {announcement(last, stage)}
        </p>
        <p className="mt-2 text-body-sm text-ink-2">{TRY.note}</p>
      </div>
    </section>
  );
}
