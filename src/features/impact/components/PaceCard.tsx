'use client';

import { ArrowRight, Info } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { PACE_INFO, type Impact } from '@/game';
import { formatPercent, formatTonnes } from '@/lib/format';
import { Approx, Button, Card, Meter, Sheet, TextLink, UiLink } from '@/ui';
import { COPY } from '../copy';
import { paceCard } from '../model';
import { ApproxText } from './ApproxText';

function Baseline({ tonnes }: { tonnes: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-caption text-ink-3">
      <span className="type-slug">0</span>
      <span aria-hidden="true" className="min-w-6 flex-1 border-t-2 border-dashed border-ink-3" />
      <span className="type-slug">
        {COPY.pace.baselineLabel} <Approx weight="mono" spoken={false} />
        {formatTonnes(tonnes)} a year
      </span>
    </div>
  );
}

/**
 * Pace against the starting line (spec 6.6). It is a projection and says so: measured so far is
 * solid, the year at this pace is hatched, the starting line is dashed. Before there is enough
 * data it shows how far along it is; without a quiz it invites one.
 */
export function PaceCard({ impact }: { impact: Impact }) {
  const card = paceCard(impact.pace);
  const info = (
    <Sheet
      title={COPY.pace.infoTitle}
      description={PACE_INFO}
      trigger={
        <Button variant="ghost" size="sm">
          <Info size={16} aria-hidden="true" />
          {COPY.pace.infoAction}
        </Button>
      }
    >
      <p className="text-body text-ink-2">{PACE_INFO}</p>
      <p className="mt-3 text-body-sm">
        <TextLink href={ROUTES.methodology}>How every figure is calculated</TextLink>
      </p>
    </Sheet>
  );

  return (
    <Card className="grid content-start gap-4">
      {card.kind === 'quiz' ? (
        <>
          <p className="max-w-prose text-body">
            <ApproxText text={impact.paceHeadline} />
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" iconRight={ArrowRight}>
              <UiLink href={`${ROUTES.me}#starting-line`}>{COPY.pace.quizAction}</UiLink>
            </Button>
            {info}
          </div>
        </>
      ) : card.kind === 'waiting' ? (
        <>
          <p className="max-w-prose text-body">
            <ApproxText text={impact.paceHeadline} />
          </p>
          <Meter
            value={card.active}
            max={card.needed}
            pips
            label={COPY.pace.waitingLabel}
            valueText={`${card.active} of ${card.needed} active days`}
          />
          <div>{info}</div>
        </>
      ) : (
        <>
          <p className="max-w-prose text-body">
            <ApproxText text={impact.paceHeadline} />
          </p>
          <div className="grid gap-2">
            <Meter
              size="lg"
              value={card.measured * 100}
              max={100}
              projected={card.projected === null ? undefined : card.projected * 100}
              label={`${COPY.pace.projectedLabel}, as a share of your starting line`}
              valueText={
                card.projected === null
                  ? COPY.pace.overHalf
                  : `${formatPercent(card.projected)} of your starting line`
              }
            />
            <Baseline tonnes={card.baselineTonnes} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 type-slug text-ink-3">
              <span>Solid: {COPY.pace.measuredLabel}</span>
              <span>Hatched: {COPY.pace.projectedLabel}</span>
            </p>
          </div>
          <div>{info}</div>
        </>
      )}
      {impact.habits.acts > 0 ? (
        <p className="border-t-[1.5px] border-dashed border-ink-4 pt-3 text-body-sm text-ink-2">
          <ApproxText text={impact.habitsCopy} />
        </p>
      ) : null}
    </Card>
  );
}
