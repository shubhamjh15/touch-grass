'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { PageHeader, PageStack } from '@/app/shell';
import { useProfile } from '@/game';
import { Segmented } from '@/ui';
import { useClimate } from './climate/useClimate';
import { PlanetView } from './components/PlanetView';
import { YouView } from './components/YouView';
import { COPY } from './copy';
import { parseView, sinceSlug, viewHref, type ImpactView } from './model';

/**
 * `/impact`, in two halves. "Your impact" is the user's own log: the one honest total, where
 * it comes from, the weeks behind it. "The planet now" is live public data fetched by our own
 * server: temperature, CO2, and CO2 per person where the user lives. The half lives in the
 * address (`?view=planet`) so it can be linked and kept.
 */
export default function ImpactPage() {
  const router = useRouter();
  const params = useSearchParams();
  const profile = useProfile();
  const { state: climate, retry } = useClimate();
  const view = parseView(params.get('view'));

  const setView = useCallback(
    (next: ImpactView) => {
      router.replace(viewHref(next, params.toString()), { scroll: false });
    },
    [params, router],
  );
  const seePlanet = useCallback(() => {
    router.push(viewHref('planet', params.toString()));
  }, [params, router]);

  return (
    <>
      <PageHeader slug={sinceSlug(profile.plantedDay)} title={COPY.title} lead={COPY.lead}>
        <Segmented
          aria-label={COPY.views.label}
          value={view}
          onValueChange={setView}
          fullWidth
          className="sm:w-auto"
          options={[
            { value: 'you', label: COPY.views.you },
            { value: 'planet', label: COPY.views.planet },
          ]}
        />
      </PageHeader>
      <PageStack>
        {view === 'you' ? (
          <YouView climate={climate} onSeePlanet={seePlanet} />
        ) : (
          <PlanetView climate={climate} onRetry={retry} />
        )}
      </PageStack>
    </>
  );
}
