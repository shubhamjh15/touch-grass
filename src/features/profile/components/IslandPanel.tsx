'use client';

import { Compass } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/app/shell';
import { effectiveDay, useBadges, useGame, useIslandLog } from '@/game';
import { formatDay } from '@/lib/format';
import { Button, Card, EmptyState, Meter } from '@/ui';
import { openExplore } from '@/world';
import { COPY } from '../copy';
import { pendingProps, splitLogLine } from '../model/island';

/**
 * The Island tab: a door into the world's full-screen Explore mode, then the Island log (every
 * arrival written in words, so the canvas never carries information alone) and the props still
 * to come with the badge tier that brings each.
 */
export function IslandPanel() {
  const log = useIslandLog();
  const board = useBadges();
  const today = useGame(effectiveDay);
  const pending = pendingProps(board.props);
  const total = board.props.length + pending.length;

  return (
    <div className="grid gap-8">
      <Card tone="paper" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-0.5">
          <p className="type-slug text-ink-3">{COPY.island.explore.slug}</p>
          <h2 className="text-h4 text-ink">{COPY.island.explore.title}</h2>
          <p className="text-body-sm text-ink-2">{COPY.island.explore.body}</p>
        </div>
        {/* The world owns Explore: full screen, labelled landmarks, a photo button, Escape to leave. */}
        <Button variant="neutral" icon={Compass} onClick={() => openExplore()}>
          {COPY.island.explore.action}
        </Button>
      </Card>

      <section aria-labelledby="island-log-heading" className="grid gap-3">
        <div className="grid gap-0.5">
          <h2 id="island-log-heading" className="text-h3">
            {COPY.island.logHeading}
          </h2>
          <p className="text-body-sm text-ink-2">{COPY.island.logLead}</p>
        </div>
        {log.length === 0 ? (
          <EmptyState
            slug={COPY.island.empty.slug}
            title={COPY.island.empty.title}
            body={COPY.island.empty.body}
            action={
              <Button asChild variant="primary">
                <Link href={ROUTES.log}>{COPY.badges.nextAction}</Link>
              </Button>
            }
          />
        ) : (
          <Card padded={false}>
            <ol
              aria-label={COPY.island.logLabel}
              className="divide-y-[1.5px] divide-ink overflow-hidden rounded-[9px] md:rounded-[12px]"
            >
              {log.map((entry) => {
                const { day, words } = splitLogLine(entry.text);
                return (
                  <li
                    key={`${entry.ts}-${entry.text}`}
                    className="flex items-start gap-3 bg-card px-4 py-3"
                  >
                    {day === null ? null : (
                      <span className="mt-0.5 w-[4.5rem] shrink-0 rounded-xs border-2 border-ink bg-yellow-tint px-1.5 py-1 text-center font-mono text-data-sm font-semibold text-ink">
                        {COPY.island.dayChip(day)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-body text-ink">{words}</span>
                      <span className="block type-slug text-ink-3">
                        {formatDay(entry.day, today)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </section>

      <section aria-labelledby="island-arrive-heading" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="grid gap-0.5">
            <h2 id="island-arrive-heading" className="text-h3">
              {COPY.island.arrivedHeading}
            </h2>
            <p className="text-body-sm text-ink-2">{COPY.island.arrivedLead(pending.length)}</p>
          </div>
          <p className="font-mono text-data text-ink-2">
            {COPY.island.count(board.props.length, total)}
          </p>
        </div>
        <Meter
          value={board.props.length}
          max={total}
          tone="green"
          size="sm"
          label={COPY.island.count(board.props.length, total)}
        />
        {pending.length === 0 ? (
          <EmptyState
            slug={COPY.island.complete.slug}
            title={COPY.island.complete.title}
            body={COPY.island.complete.body}
          />
        ) : (
          <ul aria-label={COPY.island.arrivedLabel} className="grid gap-2.5 sm:grid-cols-2">
            {pending.map((item) => (
              <li
                key={item.prop}
                className="rounded-md border-2 border-dashed border-ink-4 bg-card px-3.5 py-3"
              >
                <p className="text-body font-bold text-ink">{item.name}</p>
                <p className="text-body-sm text-ink-2">{item.requirement}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
