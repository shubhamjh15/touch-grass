'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { effectiveDay, useGame, useGameState, useRecap, type WeekRecap, weekRecap } from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { Approx, Button, CATEGORY, Co2e } from '@/ui';
import { COPY } from '../copy';
import { stripKind, weekRange } from '../model';
import { HeatSwatch } from './Heatmap';

const FIRST_PAGE = 3;
const PAGE = 6;

function Change({ kg, previous }: { kg: number; previous: number | null }) {
  if (previous === null) return null;
  const direction = kg > previous ? 'up' : kg < previous ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  const word = direction === 'up' ? 'Up from' : direction === 'down' ? 'Down from' : 'Same as';
  return (
    <span className="inline-flex items-center gap-1 text-caption text-ink-2">
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {word} <Approx weight="mono" spoken={false} />
      {formatCo2Estimate(previous)} the week before
    </span>
  );
}

function WeekCard({ recap }: { recap: WeekRecap }) {
  const top = recap.topCategory ? CATEGORY[recap.topCategory] : null;
  const days = recap.strip.map(
    (day) => `${day.label}: ${day.mark === 'today' ? 'today' : day.mark}`,
  );
  return (
    <li className="grid gap-2.5 px-4 py-3.5 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-body font-bold">{weekRange(recap.monday)}</h4>
        {recap.kg > 0 ? (
          <span className="shrink-0 font-mono text-data-lg font-semibold">
            <Approx weight="mono" />
            {formatCo2Estimate(recap.kg)} <Co2e />
          </span>
        ) : null}
      </div>
      {recap.empty ? (
        <p className="text-body-sm text-ink-2">{COPY.weeks.quiet}</p>
      ) : (
        <>
          <div role="img" aria-label={days.join(', ')} className="flex gap-1.5">
            {recap.strip.map((day) => (
              <HeatSwatch key={day.day} kind={stripKind(day.mark)} size={18} />
            ))}
          </div>
          <p className="font-mono text-data text-ink-2">
            {formatNumber(recap.rings)} {COPY.weeks.rings} · {formatNumber(recap.logs)}{' '}
            {COPY.weeks.logs}
            {recap.minutesOutside > 0
              ? ` · ${formatNumber(recap.minutesOutside)} ${COPY.weeks.outside}`
              : ''}
            {top ? ` · mostly ${top.label.toLowerCase()}` : ''}
          </p>
          <Change kg={recap.kg} previous={recap.previousKg} />
        </>
      )}
    </li>
  );
}

/** Finished weeks, newest first: the three latest at once, older ones on request. */
export function WeeksPanel() {
  const recap = useRecap();
  const state = useGameState((game) => game);
  const today = useGame(effectiveDay);
  const [shown, setShown] = useState(FIRST_PAGE);
  const weeks = recap.weeks;
  const recaps = useMemo(
    () => weeks.slice(0, shown).map((week) => weekRecap(state, week, today)),
    [state, weeks, shown, today],
  );

  if (weeks.length === 0) {
    return <p className="px-4 py-5 text-body-sm text-ink-2 md:px-5">{COPY.weeks.none}</p>;
  }
  return (
    <div>
      <ul aria-label="Finished weeks" className="divide-y-[1.5px] divide-ink">
        {recaps.map((entry) => (
          <WeekCard key={entry.week} recap={entry} />
        ))}
      </ul>
      {shown < weeks.length ? (
        <div className="border-t-[1.5px] border-ink p-3">
          <Button variant="ghost" size="sm" onClick={() => setShown((count) => count + PAGE)}>
            {COPY.weeks.more} ({formatNumber(weeks.length - shown)})
          </Button>
        </div>
      ) : null}
    </div>
  );
}
