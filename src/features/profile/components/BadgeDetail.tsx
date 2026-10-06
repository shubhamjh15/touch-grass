'use client';

import { Check } from 'lucide-react';
import { PROP_UNLOCK } from '@/data/badges';
import type { BadgeStatus } from '@/game';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BadgeMedal, Button, Meter, Modal, Tag, TiltCard } from '@/ui';
import { COPY } from '../copy';
import { tierRows } from '../model/badges';
import { medalOf } from '../model/medal';
import { PROP_NAME } from '../model/island';
import { numeral, stampDate, thresholdText } from '../model/labels';

function TierList({ status }: { status: BadgeStatus }) {
  const rows = tierRows(status);
  return (
    <ol aria-label={COPY.badges.detail.tiersHeading} className="grid gap-2">
      {rows.map((row) => {
        const earned = row.earnedTs !== null;
        return (
          <li
            key={row.tier}
            className={cn(
              'flex items-start gap-3 rounded-sm border-2 px-3 py-2.5',
              earned ? 'border-ink bg-green-tint' : 'border-dashed border-ink-4 bg-card',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2',
                earned ? 'border-ink bg-green text-ink' : 'border-ink-4 text-ink-4',
              )}
            >
              {earned ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-body-sm font-bold text-ink">
                  {COPY.badges.detail.tierLine(row.numeral)} · {row.need}
                </span>
                <span className="font-mono text-data-sm text-ink-2">
                  {COPY.badges.detail.xp(row.xp)}
                </span>
              </span>
              <span className="block text-caption text-ink-2">
                {earned
                  ? COPY.badges.detail.earnedOn(stampDate(row.earnedTs ?? 0))
                  : COPY.badges.detail.locked}
                {row.props.length > 0
                  ? ` · ${COPY.badges.detail.brings(row.props.join(', '))}`
                  : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One badge, large: its medal on a tilting card, how it is earned, every tier with its price and
 * date, and the island props it brings. A secret badge shows only its riddle until it is earned.
 */
export function BadgeDetail({
  status,
  slot,
  open,
  onOpenChange,
}: {
  status: BadgeStatus | null;
  slot: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!status) return null;
  const { badge } = status;
  const secret = status.hidden && status.tier === 0;
  const medal = medalOf(status, slot);
  const next = status.nextThreshold;
  const onIsland = status.props.filter((prop) => PROP_UNLOCK[prop].tier <= status.tier);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={secret ? COPY.badges.secretName : badge.name}
      description={secret ? (badge.riddle ?? undefined) : badge.description}
      size="sm"
      footer={
        <Button variant="neutral" onClick={() => onOpenChange(false)}>
          {COPY.badges.detail.close}
        </Button>
      }
    >
      <div className="grid gap-5">
        <div className="grid justify-items-center">
          <TiltCard maxTilt={3}>
            <BadgeMedal {...medal} size={160} />
          </TiltCard>
        </div>

        {secret ? null : (
          <>
            {next !== null ? (
              <div className="grid gap-1.5">
                <p className="flex items-baseline justify-between gap-3 text-body-sm font-semibold">
                  <span>
                    {COPY.badges.detail.progress}
                    {status.maxTier > 1
                      ? ` · ${COPY.badges.detail.tierLine(numeral(status.tier + 1, status.maxTier))}`
                      : ''}
                  </span>
                  <span className="font-mono text-data">
                    {formatNumber(Math.floor(status.value))} / {thresholdText(badge.unit, next)}
                  </span>
                </p>
                <Meter
                  value={Math.min(status.value, next)}
                  max={next}
                  tone="green"
                  label={`${badge.name} progress`}
                  valueText={status.progressText}
                />
              </div>
            ) : (
              <Tag hue="green" className="justify-self-start">
                {COPY.badges.detail.done}
              </Tag>
            )}
            <TierList status={status} />
            {onIsland.length > 0 ? (
              <p className="text-body-sm text-ink-2">
                <span className="font-bold text-ink">{COPY.badges.detail.onIsland}:</span>{' '}
                {onIsland.map((prop) => PROP_NAME[prop]).join(', ')}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
