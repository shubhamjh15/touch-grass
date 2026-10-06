'use client';

import { usePassport, useTreeStatus } from '@/game';
import { parseDayKey } from '@/lib/dates';
import { formatPercent } from '@/lib/format';
import { Lettering, Meter, Panel, Stamp, TiltCard } from '@/ui';
import { COPY } from '../copy';
import { stampDate } from '../model/labels';
import { daysPerBand } from '../model/ringDisc';
import { RingDisc } from './RingDisc';

function sentence(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Leader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 type-slug text-ink-3">{label}</dt>
      <span
        aria-hidden="true"
        className="min-w-3 flex-1 -translate-y-0.5 border-b-2 border-dotted border-ink-4"
      />
      <dd className="text-right font-mono text-data font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * The Tree Passport: a paper booklet with a kraft spine. It holds the tree's name, species and
 * stage, how far it is to the next stage, the growth-ring cross-section with its words, and the
 * four facts a passport carries. It tilts with a fine pointer and sits still on touch.
 */
export function Passport() {
  const passport = usePassport();
  const tree = useTreeStatus();
  const planted = stampDate(parseDayKey(passport.plantedDay).getTime());
  const percent = formatPercent(tree.stageProgress);
  const merged = daysPerBand(passport.ringSequence.length);

  return (
    <TiltCard className="max-w-full">
      <Panel
        variant="paper"
        as="section"
        aria-label={COPY.passport.label}
        className="relative grid overflow-hidden p-0 md:grid-cols-[3.25rem_1fr]"
      >
        <div
          aria-hidden="true"
          className="flex items-center justify-between border-b-3 border-ink bg-kraft px-4 py-2 md:flex-col md:justify-start md:gap-3 md:border-r-3 md:border-b-0 md:px-0 md:py-5"
        >
          <span className="type-slug text-ink md:[transform:rotate(180deg)] md:[writing-mode:vertical-rl]">
            {COPY.passport.spine}
          </span>
          <span className="flex gap-1.5 md:flex-col">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-2 rounded-full border-2 border-ink bg-paper" />
            ))}
          </span>
        </div>

        <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:p-6">
          <div className="grid min-w-0 content-start gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 gap-1">
                <h2 className="min-w-0">
                  <Lettering fill="yellow" className="text-display-lg break-words">
                    {passport.treeName}
                  </Lettering>
                </h2>
                <p className="text-h4 text-ink">
                  {sentence(passport.speciesLabel)} · {tree.stage}
                </p>
              </div>
              <Stamp
                label={COPY.passport.stamp}
                hue="pink"
                rotate={-7}
                className="mt-1 hidden shrink-0 sm:block"
              />
            </div>

            <div className="grid gap-1.5">
              <p className="flex items-baseline justify-between gap-3 text-body-sm font-semibold text-ink">
                <span>
                  {tree.nextStage
                    ? COPY.passport.stageTo(tree.stage, tree.nextStage)
                    : COPY.passport.stageLast(tree.stage)}
                </span>
                {tree.nextStage ? <span className="font-mono text-data">{percent}</span> : null}
              </p>
              <Meter
                value={Math.round(tree.stageProgress * 100)}
                max={100}
                tone="green"
                label={`${tree.stage} growth`}
                valueText={
                  tree.nextStage ? COPY.passport.percentSpoken(percent, tree.nextStage) : tree.stage
                }
              />
            </div>

            <dl className="grid gap-2.5 pt-1">
              <Leader label={COPY.passport.planted} value={planted} />
              <Leader
                label={COPY.passport.age}
                value={COPY.passport.ageValue(passport.dayNumber)}
              />
              <Leader
                label={COPY.passport.streak}
                value={COPY.passport.streakValue(passport.bestStreak)}
              />
              <Leader
                label={COPY.passport.outside}
                value={COPY.passport.outsideValue(passport.minutesOutside)}
              />
            </dl>
          </div>

          <figure className="grid grid-cols-[7rem_1fr] items-center gap-4 border-t-[1.5px] border-dashed border-ink-4 pt-5 lg:w-48 lg:grid-cols-1 lg:justify-items-center lg:border-t-0 lg:pt-0 lg:text-center">
            <RingDisc sequence={passport.ringSequence} className="size-28 lg:size-40" />
            <figcaption className="grid gap-1">
              <span className="type-slug text-ink-3">{COPY.passport.ringsTitle}</span>
              <span className="text-body-sm font-semibold text-ink">{passport.ringSummary}</span>
              <span className="text-caption text-ink-2">
                {merged > 1 ? COPY.passport.ringsMerged(merged) : COPY.passport.ringsLead}
              </span>
            </figcaption>
          </figure>
        </div>
      </Panel>
    </TiltCard>
  );
}
