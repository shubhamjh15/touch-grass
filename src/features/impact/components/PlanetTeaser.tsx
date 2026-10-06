'use client';

import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useGameNow, useProfile } from '@/game';
import { Button, Card, Skeleton } from '@/ui';
import { freshness, headlineReadings, type Freshness } from '../climate/model';
import type { ClimateState } from '../climate/useClimate';
import { COPY } from '../copy';
import { LiveBadge } from './LiveBadge';

/**
 * A strip on "Your impact" with the planet's three headline readings and one door to the rest.
 * It only wears "Live" when all three are; if the readings cannot be had at all it stays away.
 */
export function PlanetTeaser({
  climate,
  onSeePlanet,
}: {
  climate: ClimateState;
  onSeePlanet: () => void;
}) {
  const profile = useProfile();
  const now = useGameNow();
  const ready = climate.phase === 'ready' ? climate : null;
  const readings = useMemo(
    () => (ready ? headlineReadings(ready.payload, profile.region) : []),
    [ready, profile.region],
  );
  if (climate.phase === 'error') return null;

  const bundled = ready?.origin === 'bundled';
  const states = readings.map((reading) => freshness(reading.signal, now, bundled));
  const overall: Freshness | null =
    states.find((state) => state.kind === 'snapshot') ?? states[0] ?? null;

  return (
    <Card tone="paper" className="grid gap-4" aria-busy={ready ? undefined : true}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="type-slug text-ink-2">{COPY.planet.slug}</h2>
          <p className="mt-1 text-body-sm text-ink-2">{COPY.planet.teaserLead}</p>
        </div>
        {overall ? <LiveBadge state={overall} /> : null}
      </div>
      {ready ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[30rem]:grid-cols-3">
          {readings.map((reading) => (
            <div key={reading.id} className="min-w-0">
              <dt className="type-slug text-ink-3">{reading.label}</dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                <span className="type-figure text-display-sm">{reading.value}</span>
                <span className="text-caption font-semibold">{reading.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 min-[30rem]:grid-cols-3">
          <Skeleton shape="block" className="h-14" />
          <Skeleton shape="block" className="h-14" />
          <Skeleton shape="block" className="h-14" />
        </div>
      )}
      <div>
        <Button variant="neutral" iconRight={ArrowRight} onClick={onSeePlanet}>
          {COPY.planet.teaserAction}
        </Button>
      </div>
    </Card>
  );
}
