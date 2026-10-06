'use client';

import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { GRID_BY_ID } from '@/data/catalogue';
import {
  BASELINE_SEGMENTS,
  BASELINE_SEGMENT_LABELS,
  baselineReferences,
  biggestLevers,
  isLowFootprint,
  useGameNow,
} from '@/game';
import { cn } from '@/lib/cn';
import { dayKey } from '@/lib/dates';
import { formatDecimal, formatPercent, formatTonnes } from '@/lib/format';
import {
  Approx,
  Button,
  CATEGORY,
  Co2e,
  HonestyMark,
  Receipt,
  Tag,
  TapeNote,
  TextLink,
  type EstimateSource,
} from '@/ui';
import { BaselineBar, SEGMENT_FILL, SEGMENT_MARK } from '../components/BaselineBar';
import { StepFrame } from '../components/StepFrame';
import { COPY, LEVER_COPY, labelDate } from '../copy';
import { draftBaseline, draftSuggestedFocus, regionName } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** The quiz is good to about ±40% (evidence base, `baselineModel.uncertainty`). */
const SPREAD = 0.4;

/**
 * The honest result of the starting-line quiz: one rounded figure, what it covers and what
 * it leaves out, how it splits, and two reference points on the same scale. No verdict.
 */
export function ResultStep({ flow }: { flow: OnboardingFlow }) {
  const { draft, change, next } = flow;
  const today = dayKey(useGameNow());
  const tonnes = draftBaseline(draft);
  if (!tonnes) return null;

  const place = GRID_BY_ID.get(draft.region)?.name ?? regionName(draft.region);
  const references = baselineReferences(draft.region, place);
  const levers = biggestLevers(tonnes);
  const suggested = draftSuggestedFocus(draft);
  const figure = formatTonnes(tonnes.total).replace(/\s*t$/, '');

  const source: EstimateSource = {
    code: 'BASELINE',
    kind: 'factor',
    formula: `${BASELINE_SEGMENTS.map((segment) => formatDecimal(tonnes[segment], 2)).join(' + ')} = ${formatTonnes(tonnes.total)}`,
    comparedWith: COPY.result.compared,
    range: `${formatTonnes(tonnes.total * (1 - SPREAD))}–${formatTonnes(tonnes.total * (1 + SPREAD))}`,
    sourceLabel: COPY.result.source,
    href: `${ROUTES.methodology}#baseline`,
  };

  const useThese = () => {
    change({ type: 'focus-suggested' });
    next();
  };
  const pickOwn = () => {
    change({ type: 'focus-own' });
    next();
  };

  return (
    <StepFrame
      slug={COPY.result.slug}
      title={COPY.result.title}
      onSubmit={useThese}
      footer={
        <>
          <Button type="submit" variant="primary" size="lg" iconRight={ArrowRight} fullWidth>
            {COPY.result.useThese}
          </Button>
          <Button type="button" variant="neutral" size="lg" fullWidth onClick={pickOwn}>
            {COPY.result.pickOwn}
          </Button>
        </>
      }
    >
      <div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink">
          <span className="inline-flex items-center gap-2">
            <HonestyMark source={source} />
            <span className="type-figure text-display-xl">
              <Approx spoken />
              {figure}
            </span>
          </span>
          <span className="text-h3">
            {COPY.result.unit} <Co2e explain /> {COPY.result.perYear}
          </span>
        </p>
        <p className="mt-2 text-body-sm text-ink-2">{COPY.result.caption}</p>
      </div>

      <div>
        <BaselineBar tonnes={tonnes} references={references} />
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5" aria-hidden="true">
          {BASELINE_SEGMENTS.map((segment) => (
            <li key={segment} className="inline-flex items-center gap-1.5 text-caption text-ink-2">
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-[3px] border-[1.5px] border-ink font-mono text-[0.5625rem] leading-none font-bold text-ink',
                  SEGMENT_FILL[segment],
                )}
              >
                {SEGMENT_MARK[segment]}
              </span>
              {BASELINE_SEGMENT_LABELS[segment]}
            </li>
          ))}
        </ul>
        <ol className="mt-3 flex flex-col gap-1.5">
          {references.map((reference, index) => (
            <li key={reference.label} className="flex gap-2 text-caption text-ink-2">
              <span
                aria-hidden="true"
                className="mt-px grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-ink bg-white font-mono text-[0.625rem] leading-none font-bold text-ink"
              >
                {index + 1}
              </span>
              <span>{reference.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <Receipt
        title={COPY.result.title}
        meta={`${labelDate(today)} · ${place}`}
        rows={BASELINE_SEGMENTS.map((segment) => ({
          label: BASELINE_SEGMENT_LABELS[segment],
          value: (
            <>
              <Approx weight="mono" />
              {formatTonnes(tonnes[segment])} ·{' '}
              {formatPercent(tonnes.total > 0 ? tonnes[segment] / tonnes.total : 0)}
            </>
          ),
        }))}
        total={{
          label: 'A year, about',
          value: (
            <>
              <Approx weight="mono" />
              {formatTonnes(tonnes.total)}
            </>
          ),
        }}
      />

      <p className="text-caption text-pretty text-ink-3">{COPY.result.scope}</p>

      <section aria-labelledby="levers-title">
        <h2 id="levers-title" className="text-h4 text-ink">
          {COPY.result.levers}
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {levers.map((lever) => (
            <li key={lever.segment} className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-label text-ink">{lever.label}</span>
                {lever.categories.map((category) => (
                  <Tag key={category} category={category} />
                ))}
              </span>
              <span className="text-body-sm text-ink-2">{LEVER_COPY[lever.segment]}</span>
            </li>
          ))}
        </ul>
      </section>

      {isLowFootprint(tonnes) ? (
        <TapeNote tone="yellow" tape="green" rotate={-1}>
          {COPY.result.light}
        </TapeNote>
      ) : null}

      <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-ink-2">
        Suggested focus:
        {suggested.map((category) => (
          <Tag key={category} category={category}>
            {CATEGORY[category].label}
          </Tag>
        ))}
      </p>

      <p className="text-body-sm">
        <TextLink href={source.href} target="_blank" rel="noopener">
          {COPY.result.how}
        </TextLink>
        <span className="text-ink-3"> (opens in a new tab)</span>
      </p>
    </StepFrame>
  );
}
