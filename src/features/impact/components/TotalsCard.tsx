'use client';

import { useMemo } from 'react';
import type { Impact } from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { Approx, Card, Co2e, NumberTicker, StatReadout } from '@/ui';
import { COPY } from '../copy';
import { kgParts, totalsSource } from '../model';
import { ApproxText } from './ApproxText';

function Stub({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="min-w-0 px-3 py-3 not-first:border-l-2 not-first:border-dashed not-first:border-ink lg:px-5 lg:py-4">
      <dt className="truncate type-slug text-ink-3">{label}</dt>
      <dd className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap">
        <span className="type-figure text-display-sm lg:text-display-md">
          <NumberTicker value={value} format={formatNumber} />
        </span>
        {unit ? <span className="text-caption font-semibold">{unit}</span> : null}
      </dd>
    </div>
  );
}

/**
 * The one big honest number, with the way it was made one tap away, and the three exact counts
 * beneath it (those are counted, not estimated, so they carry no "≈"). The only hero figure on
 * the page, and the only object with a colour plate under it.
 */
export function TotalsCard({ impact }: { impact: Impact }) {
  const source = useMemo(() => totalsSource(impact), [impact]);
  const parts = kgParts(impact.kg);
  // One honest picture of the total next to it; the receipt below lists the rest.
  const equivalent = impact.equivalences[0];
  return (
    <Card padded={false} featured aria-label={COPY.totals.label} role="group">
      <div className="px-4 pt-4 pb-4 md:px-6 md:pt-6 lg:px-7">
        <StatReadout
          size="hero"
          label={COPY.totals.hero}
          value={parts.value}
          unit={
            <span className="text-body font-semibold">
              {parts.unit} <Co2e explain />
            </span>
          }
          source={source}
        />
        <p className="mt-2.5 max-w-prose text-body-sm text-ink-2">
          {COPY.totals.heroNote}
          {equivalent ? (
            <>
              {' '}
              <ApproxText text={equivalent.text} />
            </>
          ) : null}
        </p>
        {impact.aiKg > 0 ? (
          <p className="mt-1.5 max-w-prose text-caption text-ink-3">
            {COPY.totals.aiLine} <Approx weight="mono" spoken={false} />
            {formatCo2Estimate(impact.aiKg)} <Co2e />.
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 border-t-2 border-dashed border-ink">
        <Stub label={COPY.totals.logs} value={impact.logs} />
        <Stub label={COPY.totals.rings} value={impact.rings} />
        <Stub label={COPY.totals.outside} value={impact.minutesOutside} />
      </dl>
    </Card>
  );
}
