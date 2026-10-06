'use client';

import { ROUTES } from '@/app/routes';
import { baselineSegments, isLowFootprint, useProfile } from '@/game';
import { formatDecimal, formatPercent, formatTonnes } from '@/lib/format';
import { Approx, Button, CATEGORY, Card, Co2e, HonestyMark, type EstimateSource } from '@/ui';
import { StepFrame } from '../components/StepFrame';
import { COPY, joinWords } from '../copy';
import { draftBaseline, draftFocus } from '../flow';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** The quiz is good to about ±40% (evidence base, `baselineModel.uncertainty`). */
const SPREAD = 0.4;

/**
 * The honest result of the starting-line quiz on one screen: one rounded figure, how sure it
 * is, where it comes from and what it leaves out. No verdict, no comparison with anyone.
 */
export function ResultStep({ flow }: { flow: OnboardingFlow }) {
  const { region } = useProfile();
  const tonnes = draftBaseline(flow.draft, region);
  if (!tonnes) return null;

  const parts = baselineSegments(tonnes);
  const largest = Math.max(...parts.map((part) => part.tonnes), 0.01);
  const focus = joinWords(draftFocus(flow.draft, region).map((id) => CATEGORY[id].label));

  const source: EstimateSource = {
    code: 'BASELINE',
    kind: 'factor',
    formula: `${parts.map((part) => formatDecimal(part.tonnes, 2)).join(' + ')} = ${formatTonnes(tonnes.total)}`,
    comparedWith: COPY.result.covers,
    range: `${formatTonnes(tonnes.total * (1 - SPREAD))} to ${formatTonnes(tonnes.total * (1 + SPREAD))}`,
    sourceLabel: COPY.result.source,
    href: `${ROUTES.methodology}#baseline`,
  };

  return (
    <StepFrame
      title={COPY.result.title}
      onSubmit={flow.next}
      footer={
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {COPY.next}
        </Button>
      }
    >
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-ink">
          <span className="text-display-lg font-bold tracking-tight">
            <Approx />
            {formatDecimal(tonnes.total, 1)}
          </span>
          <span className="text-h3">
            {COPY.result.unit} <Co2e explain /> {COPY.result.perYear}
          </span>
          <HonestyMark source={source} className="self-center" />
        </p>
        <p className="mt-3 text-body text-pretty text-ink-2">{COPY.result.caption}</p>
      </div>

      <Card>
        <h2 className="text-h4 text-ink">{COPY.result.parts}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {parts.map((part) => (
            <li key={part.segment} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-body-sm font-semibold text-ink">
                {part.label}
              </span>
              <span
                aria-hidden="true"
                className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-line"
              >
                <span
                  className="absolute inset-0 origin-left rounded-pill bg-blue"
                  style={{ transform: `scaleX(${part.tonnes / largest})` }}
                />
              </span>
              <span className="sr-only">
                approximately {formatTonnes(part.tonnes)}, {formatPercent(part.share)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-body-sm text-pretty text-ink-3">{COPY.result.scope}</p>
      </Card>

      <p className="text-body text-pretty text-ink">
        {isLowFootprint(tonnes) ? `${COPY.result.light} ` : null}
        {COPY.result.focus(focus)}
      </p>
    </StepFrame>
  );
}
