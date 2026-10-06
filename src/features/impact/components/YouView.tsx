'use client';

import { ArrowRight, Sprout } from 'lucide-react';
import { useState } from 'react';
import { PageSection } from '@/app/shell';
import { ROUTES } from '@/app/routes';
import { useGameNow, useImpact } from '@/game';
import { formatTime } from '@/lib/format';
import { Button, EmptyState, TabPanel, Tabs, TextLink, UiLink } from '@/ui';
import { COPY } from '../copy';
import type { ClimateState } from '../climate/useClimate';
import { stampLine } from '../model';
import { CategoryCard } from './CategoryCard';
import { EquivalencesCard } from './EquivalencesCard';
import { Heatmap } from './Heatmap';
import { HistoryPanel } from './HistoryPanel';
import { PaceCard } from './PaceCard';
import { PlanetTeaser } from './PlanetTeaser';
import { TotalsCard } from './TotalsCard';
import { TrendCard } from './TrendCard';
import { WeeksPanel } from './WeeksPanel';

type Deep = 'weeks' | 'history';

/** Weeks and the full history share one card with index tabs: the detail is there, not in the way. */
function Archive() {
  const [tab, setTab] = useState<Deep>('weeks');
  const impact = useImpact();
  return (
    <Tabs
      aria-label="Weeks and history"
      value={tab}
      onValueChange={setTab}
      tabs={[
        { value: 'weeks', label: COPY.weeks.tab },
        { value: 'history', label: COPY.weeks.history, count: impact.logs },
      ]}
    >
      <TabPanel value="weeks" className="p-0 md:p-0">
        <WeeksPanel />
      </TabPanel>
      <TabPanel value="history" className="p-0 md:p-0">
        <HistoryPanel />
      </TabPanel>
    </Tabs>
  );
}

/**
 * The personal half of /impact: the one total, where it comes from, what it looks like in daily
 * life, the pace, and the archive. With no logs it is one kind invitation, not a page of zeros.
 */
export function YouView({
  climate,
  onSeePlanet,
}: {
  climate: ClimateState;
  onSeePlanet: () => void;
}) {
  const impact = useImpact();
  const now = useGameNow();

  if (impact.empty) {
    return (
      <div className="grid gap-8 lg:gap-10">
        <EmptyState
          slug={COPY.empty.slug}
          title={COPY.empty.title}
          body={COPY.empty.body}
          illustration={
            <Sprout size={44} strokeWidth={2} aria-hidden="true" className="text-green-deep" />
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Button asChild variant="primary" iconRight={ArrowRight}>
                <UiLink href={ROUTES.log}>{COPY.empty.action}</UiLink>
              </Button>
              <Button variant="ghost" onClick={onSeePlanet}>
                {COPY.empty.planet}
              </Button>
            </div>
          }
        />
        <PlanetTeaser climate={climate} onSeePlanet={onSeePlanet} />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:gap-10">
      <TotalsCard impact={impact} />
      <PageSection title="Where it comes from" lead={COPY.categories.lead}>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <CategoryCard impact={impact} />
          <TrendCard impact={impact} />
        </div>
      </PageSection>
      <PageSection
        title="Showing up"
        lead="Your days since planting, and what the total looks like in daily life."
      >
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Heatmap heatmap={impact.heatmap} />
          <EquivalencesCard impact={impact} meta={stampLine(now, formatTime(now))} />
        </div>
      </PageSection>
      <PlanetTeaser climate={climate} onSeePlanet={onSeePlanet} />
      <PageSection title={COPY.pace.title} lead={COPY.pace.lead}>
        <PaceCard impact={impact} />
      </PageSection>
      <PageSection
        title="Weeks and history"
        lead="Every finished week, and every log with a delete when you need one."
      >
        <Archive />
      </PageSection>
      <p className="text-body-sm text-ink-2">
        Want to see how every number is made?{' '}
        <TextLink href={ROUTES.methodology}>Read the methodology</TextLink>.
      </p>
    </div>
  );
}
