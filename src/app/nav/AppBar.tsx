'use client';

import { Flame } from 'lucide-react';
import { gameActions, useHud, useLevelInfo, useProfile, useSettings } from '@/game';
import { cn } from '@/lib/cn';
import { formatCo2EstimateParts, formatNumber, pluralize } from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Approx,
  Avatar,
  Button,
  Co2e,
  HonestyMark,
  OfflineBanner,
  Sheet,
  StickerPill,
  Switch,
  UiLink,
  XPBar,
} from '@/ui';
import { ROUTES } from '../routes';
import { openCoach, useShellStore } from '../shellStore';
import { RainClouds, StreakDetails, totalSource, useHudFlashes } from './Hud';

/**
 * The mobile app bar (below `lg`): three die-cut chips, each with its own backing, so it can sit
 * on the mat or float over the top of a bleed stage. It scrolls away with the page.
 */
export function AppBar({ overlay }: { overlay: boolean }) {
  const hud = useHud();
  const profile = useProfile();
  const { streakFlash } = useHudFlashes();
  const hudOpen = useShellStore((state) => state.hudOpen);
  const setHudOpen = useShellStore((state) => state.setHudOpen);
  const treeNudge = useShellStore((state) => state.treeNudge);

  return (
    <>
      <header
        className={cn(
          'flex h-[calc(64px+var(--safe-t))] items-center gap-2.5 px-[max(16px,var(--safe-l))] pt-(--safe-t) lg:hidden',
          overlay && 'pointer-events-none absolute inset-x-0 top-0 z-(--z-sticky)',
        )}
      >
        <span
          // A reward landed while the grove is small or docked: the chip takes the bow.
          key={treeNudge}
          className={cn('pointer-events-auto', treeNudge > 0 && 'animate-stick calm:animate-none')}
        >
          <Avatar
            kind="tree"
            species={profile.species}
            size={42}
            className="shadow-2"
            label={`${profile.treeName || 'Your tree'}: level ${formatNumber(hud.level)}. Open your stats.`}
            onClick={() => setHudOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={hudOpen}
            data-tree-chip=""
            badge={formatNumber(hud.level)}
          />
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setHudOpen(true)}
          aria-label={`Streak: ${pluralize(hud.streak, 'day')}. Open your stats.`}
          className="pointer-events-auto hit-2 relative cursor-pointer rounded-pill"
        >
          <StickerPill
            hue="yellow"
            margin={3}
            rotate={-2}
            className={cn(
              'type-figure text-display-xs transition-transform duration-(--dur-base) ease-stick',
              streakFlash !== null && 'scale-115 calm:scale-100',
            )}
          >
            <Flame size={16} strokeWidth={2.5} aria-hidden="true" className="fill-orange" />
            {formatNumber(hud.streak)}
            <RainClouds bank={hud.rainBank} />
          </StickerPill>
        </button>
        {/* The wrapper has no box of its own: it only names the button for the demo's tour. */}
        <span data-tour="nav-coach" className="contents">
          <Avatar
            kind="moss"
            size={44}
            className="pointer-events-auto shadow-2"
            label="Ask Moss, your coach"
            onClick={() => openCoach()}
          />
        </span>
      </header>

      {/* Zero height, so going offline never pushes the page down. */}
      <div className="pointer-events-none sticky top-[calc(var(--safe-t)+8px)] z-(--z-sticky) flex h-0 justify-center lg:hidden">
        <OfflineBanner />
      </div>

      <HudSheet open={hudOpen} onOpenChange={setHudOpen} />
    </>
  );
}

/** Everything the desktop HUD shows, for a thumb: level, streak, rain, the estimate, sound. */
function HudSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hud = useHud();
  const level = useLevelInfo();
  const settings = useSettings();
  const { justEarned } = useHudFlashes();
  const kg = formatCo2EstimateParts(hud.kg);
  const levelSpan = level.nextLevelXp - level.levelStartXp;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={hud.treeName ? `${hud.treeName}'s numbers` : 'Your numbers'}
      footer={
        <Button asChild variant="neutral" fullWidth>
          <UiLink href={ROUTES.me} onClick={() => onOpenChange(false)}>
            Passport and settings
          </UiLink>
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        <section aria-label="Level" className="grid gap-2">
          <p className="flex items-baseline justify-between gap-3">
            <span className="type-slug text-ink-3">
              Level {formatNumber(hud.level)} · {hud.title}
            </span>
            <span className="font-mono text-data text-ink-2">
              {formatNumber(level.xpToNext)} XP to go
            </span>
          </p>
          <XPBar
            level={hud.level}
            xp={level.xpIntoLevel}
            xpForNext={levelSpan}
            justEarned={justEarned}
          />
        </section>

        <section aria-label="Streak" className="rounded-md border-2 border-ink bg-yellow-tint p-3">
          <StreakDetails hud={hud} />
        </section>

        <section aria-label="Estimated impact" className="flex items-center gap-3">
          <HonestyMark source={totalSource()} />
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <Approx spoken={false} />
            <span className="sr-only">About</span>
            <span className="type-figure text-display-sm">{kg.value}</span>
            <span className="text-body-sm text-ink-2">
              {kg.unit} <Co2e explain /> avoided so far
            </span>
          </p>
        </section>

        <Switch
          label="Sound"
          description="Paper, felt and a small glockenspiel."
          checked={settings.sound}
          onCheckedChange={(sound) => {
            gameActions.updateSettings({ sound });
            if (sound) window.setTimeout(() => play('toggle', { on: true }), 0);
          }}
        />
      </div>
    </Sheet>
  );
}
