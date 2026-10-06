'use client';

import { useLevelInfo, useQuests, useStreak, useToday } from '@/game';
import { useBreakpoint } from '@/lib/hooks';
import { formatCo2Parts, formatNumber } from '@/lib/format';
import { Co2e, HonestyMark, NumberTicker, Ticket, XPBar } from '@/ui';
import { todayEstimateSource } from '../model';

/**
 * The perforated status ticket. On a phone it carries what the missing top bar would:
 * level, streak and today's estimate. On a desk the HUD already shows level and streak,
 * so the ticket is about today alone: estimate, logs, quests.
 */
export function StatusTicket({ xpJustEarned = 0 }: { xpJustEarned?: number }) {
  const desktop = useBreakpoint('lg');
  const today = useToday();
  const level = useLevelInfo();
  const streak = useStreak();
  const quests = useQuests();

  const kg = formatCo2Parts(today.kg);
  const source = todayEstimateSource(today);
  const claimed = quests.daily.filter((quest) => quest.claimed).length;
  const estimate = (
    <span className="inline-flex items-center gap-1.5">
      <HonestyMark source={source} size="sm" />
      <span>{kg.value}</span>
    </span>
  );

  if (desktop) {
    return (
      <Ticket label="Today at a glance">
        <Ticket.Stub
          label="Avoided today"
          flex={1.5}
          value={estimate}
          unit={
            <>
              {kg.unit} <Co2e explain />
            </>
          }
        />
        <Ticket.Stub label="Logged" value={<NumberTicker value={today.logs.length} />} />
        <Ticket.Stub
          label="Quests"
          value={<NumberTicker value={claimed} />}
          unit={`of ${formatNumber(quests.daily.length)}`}
        />
      </Ticket>
    );
  }

  return (
    <Ticket label="Level, streak and today">
      <Ticket.Stub
        label="Level"
        meta={`${formatNumber(level.xpIntoLevel)}/${formatNumber(level.nextLevelXp - level.levelStartXp)}`}
        value={<NumberTicker value={level.level} />}
        flex={1.45}
      >
        <XPBar
          level={level.level}
          xp={level.xpIntoLevel}
          xpForNext={level.nextLevelXp - level.levelStartXp}
          justEarned={xpJustEarned}
          hideLevel
          hideCount
        />
      </Ticket.Stub>
      <Ticket.Stub
        label="Streak"
        value={<NumberTicker value={streak.current} />}
        unit={streak.current === 1 ? 'day' : 'days'}
      />
      <Ticket.Stub
        label="Today"
        value={estimate}
        unit={
          <>
            {kg.unit}
            <span className="sr-only">
              {' '}
              <Co2e explain /> avoided
            </span>
          </>
        }
      />
    </Ticket>
  );
}
