'use client';

import { CloudRain, Flame } from 'lucide-react';
import { useEffect } from 'react';
import { useHud, useLevelInfo, useStreak, type Hud as HudModel } from '@/game';
import { cn } from '@/lib/cn';
import { formatCo2EstimateParts, formatNumber, pluralize } from '@/lib/format';
import {
  HonestyMark,
  NumberTicker,
  Popover,
  StickerPill,
  TextLink,
  UiLink,
  XPBar,
  type EstimateSource,
} from '@/ui';
import { ROUTES } from '../routes';
import { useShellStore } from '../shellStore';

/** How long the XP that was just earned stays yellow, and a milestone pill stays stuck. */
const XP_FLASH_MS = 900;
const STREAK_FLASH_MS = 3000;

/** The lifetime total is a sum of sourced estimates: the mark says so and links to the table. */
export function totalSource(): EstimateSource {
  return {
    code: 'TOTAL',
    kind: 'factor',
    formula: 'Sum of every logged action that has a sourced factor',
    comparedWith:
      'Each action is compared with its usual alternative, like driving the same trip. Custom and unquantified actions add nothing here.',
    sourceLabel: 'Factor table',
    href: ROUTES.methodology,
  };
}

/** Clears the HUD's short-lived highlights once they have been seen. */
export function useHudFlashes(): { justEarned: number; streakFlash: number | null } {
  const justEarned = useShellStore((state) => state.xpJustEarned);
  const streakFlash = useShellStore((state) => state.streakFlash);

  useEffect(() => {
    if (justEarned <= 0) return undefined;
    const timer = window.setTimeout(() => useShellStore.getState().flashXp(0), XP_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [justEarned]);

  useEffect(() => {
    if (streakFlash === null) return undefined;
    const timer = window.setTimeout(
      () => useShellStore.getState().flashStreak(null),
      STREAK_FLASH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [streakFlash]);

  return { justEarned, streakFlash };
}

/** Up to two small rain clouds: the days a missed check-in is covered. */
export function RainClouds({ bank, className }: { bank: number; className?: string }) {
  if (bank <= 0) return null;
  return (
    <span className={cn('flex items-center gap-0.5', className)} aria-hidden="true">
      {Array.from({ length: Math.min(2, bank) }, (_, index) => (
        <CloudRain key={index} size={12} strokeWidth={2.5} className="text-blue-deep" />
      ))}
    </span>
  );
}

/** What the streak cell opens: the chain in words, the rain bank, the next bonus. */
export function StreakDetails({ hud }: { hud: HudModel }) {
  const streak = useStreak();
  return (
    <div className="grid gap-2">
      <p className="type-slug text-ink-3">Streak</p>
      <p className="text-h4">
        {hud.streak > 0 ? `${pluralize(hud.streak, 'day')} running` : 'Day 1 starts with one tap'}
      </p>
      <p className="text-body-sm text-ink-2">
        {streak.rainBank > 0
          ? `${pluralize(streak.rainBank, 'cloud')} banked. A cloud covers a day you miss, so the streak survives.`
          : 'No rain banked yet. Full rings earn clouds, and a cloud covers a day you miss.'}
      </p>
      <p className="flex items-baseline justify-between gap-3 font-mono text-data text-ink-2">
        <span>Best</span>
        <span>{pluralize(streak.best, 'day')}</span>
      </p>
      {streak.nextMilestone ? (
        <p className="flex items-baseline justify-between gap-3 font-mono text-data text-ink-2">
          <span>Next bonus</span>
          <span>
            day {formatNumber(streak.nextMilestone.days)} · +{formatNumber(streak.nextMilestone.xp)}{' '}
            XP
          </span>
        </p>
      ) : null}
      <TextLink href={ROUTES.me} className="text-body-sm font-semibold">
        Rest days and settings
      </TextLink>
    </div>
  );
}

const CELL = 'flex items-center gap-2 px-3 focus-inset';
const DIVIDER = 'border-l-2 border-dashed border-ink';

/**
 * The desktop HUD: a strip of paper stubs in the top bar. Level and XP, the streak with its rain
 * clouds, and the lifetime estimate with its honesty mark. Level and streak show from `lg`; the
 * estimate joins at 1440 px.
 */
export function Hud({ className }: { className?: string }) {
  const hud = useHud();
  const level = useLevelInfo();
  const { justEarned, streakFlash } = useHudFlashes();
  const levelSpan = level.nextLevelXp - level.levelStartXp;
  const kg = formatCo2EstimateParts(hud.kg);

  return (
    <div
      role="group"
      aria-label="Your progress"
      className={cn(
        'relative flex h-11 shrink-0 items-stretch rounded-ctl border-3 border-ink bg-paper',
        className,
      )}
    >
      <UiLink
        href={ROUTES.me}
        aria-label={`Level ${formatNumber(hud.level)}, ${hud.title}. ${formatNumber(level.xpIntoLevel)} of ${formatNumber(levelSpan)} XP. Open your passport.`}
        className={cn(CELL, 'rounded-l-[7px]')}
        data-hud-cell="level"
      >
        <span className="type-slug text-ink-3" aria-hidden="true">
          LV
        </span>
        <NumberTicker value={hud.level} className="type-figure text-display-xs" />
        <XPBar
          compact
          aria-hidden="true"
          level={hud.level}
          xp={level.xpIntoLevel}
          xpForNext={levelSpan}
          justEarned={justEarned}
        />
      </UiLink>

      <Popover
        width={280}
        align="center"
        label="Streak"
        trigger={
          <button
            type="button"
            aria-label={`Streak: ${pluralize(hud.streak, 'day')}. ${pluralize(hud.rainBank, 'cloud')} banked.`}
            className={cn(
              CELL,
              DIVIDER,
              'cursor-pointer min-[1440px]:rounded-none',
              'max-[1439px]:rounded-r-[7px]',
            )}
            data-hud-cell="streak"
          >
            <Flame
              size={16}
              strokeWidth={2.5}
              aria-hidden="true"
              className={cn(
                'fill-orange text-ink transition-transform duration-(--dur-base) ease-stick',
                streakFlash !== null && 'scale-140 calm:scale-100',
              )}
            />
            <NumberTicker value={hud.streak} className="type-figure text-display-xs" />
            <RainClouds bank={hud.rainBank} />
          </button>
        }
      >
        <StreakDetails hud={hud} />
      </Popover>

      <div
        className={cn(CELL, DIVIDER, 'hidden rounded-r-[7px] min-[1440px]:flex')}
        data-hud-cell="kg"
      >
        <HonestyMark source={totalSource()} size="sm" />
        <UiLink
          href={ROUTES.impact}
          aria-label={`About ${kg.value} ${kg.unit} of CO2e avoided so far. Open Impact.`}
          className="flex items-baseline gap-1.5 rounded-xs focus-inset"
        >
          <NumberTicker
            value={hud.kg}
            format={(value) => formatCo2EstimateParts(value).value}
            className="type-figure text-display-xs"
          />
          <span className="type-slug text-ink-3" aria-hidden="true">
            {kg.unit} avoided
          </span>
        </UiLink>
      </div>

      {streakFlash !== null ? (
        <StickerPill
          hue="yellow"
          rotate={-2}
          margin={3}
          icon={Flame}
          role="status"
          className="absolute top-full left-1/2 mt-2 -translate-x-1/2 animate-stick whitespace-nowrap calm:animate-none"
        >
          {formatNumber(streakFlash)} days running
        </StickerPill>
      ) : null}
    </div>
  );
}
