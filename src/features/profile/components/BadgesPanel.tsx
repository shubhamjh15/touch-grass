'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/app/shell';
import { useBadges, type BadgeStatus } from '@/game';
import { BadgeMedal, Button, Chip, EmptyState, Meter } from '@/ui';
import { COPY } from '../copy';
import { BADGE_FILTERS, filterBadges, filterCounts, type BadgeFilter } from '../model/badges';
import { numeral } from '../model/labels';
import { medalOf } from '../model/medal';
import { BadgeDetail } from './BadgeDetail';

function Nudge({ nearest, firstRun }: { nearest: BadgeStatus | null; firstRun: boolean }) {
  if (firstRun) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-ink bg-yellow-tint p-3.5">
        <p className="min-w-0 flex-1 basis-60 text-body-sm font-semibold text-ink">
          {COPY.badges.firstRun}
        </p>
        <Button asChild variant="primary" size="sm">
          <Link href={ROUTES.log}>{COPY.badges.nextAction}</Link>
        </Button>
      </div>
    );
  }
  if (!nearest) {
    return (
      <p className="rounded-md border-2 border-ink bg-green-tint p-3.5 text-body-sm font-semibold text-ink">
        {COPY.badges.allEarned}
      </p>
    );
  }
  const name = `${nearest.badge.name} ${numeral(nearest.tier + 1, nearest.maxTier)}`.trim();
  return (
    <div className="grid gap-3 rounded-md border-2 border-ink bg-card p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid min-w-0 gap-1.5">
        <p className="type-slug text-ink-3">{COPY.badges.nextSlug}</p>
        <p className="text-body font-bold text-ink">
          {COPY.badges.nextLine(name, nearest.progressText)}
        </p>
        <Meter
          value={Math.round(nearest.progress * 100)}
          max={100}
          tone="green"
          size="sm"
          label={`${name} progress`}
          valueText={nearest.progressText}
        />
      </div>
      <Button
        asChild
        variant="neutral"
        size="sm"
        className="justify-self-start sm:justify-self-end"
      >
        <Link href={ROUTES.log}>{COPY.badges.nextAction}</Link>
      </Button>
    </div>
  );
}

/**
 * The album: every badge as an earned stamp, a numbered slot with its progress, or a secret.
 * Filters narrow the grid; any medal opens its detail. The closest unearned badge sits on top as
 * the one next step.
 */
export function BadgesPanel() {
  const board = useBadges();
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = filterCounts(board.all);
  const shown = filterBadges(board.all, filter);
  const slotOf = (status: BadgeStatus) =>
    board.all.findIndex((entry) => entry.badge.id === status.badge.id) + 1;
  const open = board.all.find((status) => status.badge.id === openId) ?? null;

  return (
    <div className="grid gap-4">
      <Nudge nearest={board.nearest} firstRun={board.badgesEarned === 0} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-body-sm text-ink-2">
          <span className="font-mono text-data font-semibold text-ink">
            {COPY.badges.count(counts.earned, counts.all)}
          </span>{' '}
          badges · {COPY.badges.tiers(board.tiersEarned, board.tiersTotal)}
        </p>
        <div role="group" aria-label={COPY.badges.filterLabel} className="flex flex-wrap gap-2">
          {BADGE_FILTERS.map((value) => (
            <Chip
              key={value}
              selected={filter === value}
              onSelectedChange={() => setFilter(value)}
              count={counts[value]}
            >
              {COPY.badges.filters[value]}
            </Chip>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        filter === 'earned' ? (
          <EmptyState
            slug={COPY.badges.nothingEarned.slug}
            title={COPY.badges.nothingEarned.title}
            body={COPY.badges.nothingEarned.body}
            action={
              <Button asChild variant="primary">
                <Link href={ROUTES.log}>{COPY.badges.nothingEarned.action}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            slug={COPY.badges.nothingLocked.slug}
            title={COPY.badges.nothingLocked.title}
            body={COPY.badges.nothingLocked.body}
          />
        )
      ) : (
        <ul
          aria-label={COPY.badges.gridLabel}
          className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-6 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
        >
          {shown.map((status) => {
            const slot = slotOf(status);
            const medal = medalOf(status, slot);
            const earned = medal.state === 'earned';
            return (
              <li key={status.badge.id} className="relative">
                <BadgeMedal
                  {...medal}
                  size={96}
                  onOpen={earned ? () => setOpenId(status.badge.id) : undefined}
                />
                {earned ? null : (
                  <button
                    type="button"
                    onClick={() => setOpenId(status.badge.id)}
                    aria-label={
                      medal.state === 'secret'
                        ? COPY.badges.openSecret
                        : COPY.badges.openLocked(status.badge.name)
                    }
                    className="absolute inset-0 rounded-md"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <BadgeDetail
        status={open}
        slot={open ? slotOf(open) : 0}
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      />
    </div>
  );
}
