'use client';

import { Flame, UserRound } from 'lucide-react';
import { useHud, useProfile } from '@/game';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { UiLink } from '@/ui';
import { ROUTES, type RouteId } from '../routes';
import { Logo } from './Logo';
import { NAV_ITEMS } from './navItems';

/** Streak and level: the only numbers the chrome carries. */
function Status() {
  const { streak, level } = useHud();
  return (
    <p className="flex items-center gap-2 font-mono text-body-sm text-ink">
      <span className="inline-flex items-center gap-1">
        <Flame size={20} strokeWidth={1.75} aria-hidden="true" className="text-orange-deep" />
        {formatNumber(streak)}
        <span className="sr-only">day streak</span>
      </span>
      <span className="inline-flex h-7 items-center rounded-pill border-2 border-ink bg-white px-2.5">
        <span aria-hidden="true">Lv&nbsp;</span>
        <span className="sr-only">Level </span>
        {formatNumber(level)}
      </span>
    </p>
  );
}

/** The way to Me that carries the user's initial. */
function ProfileLink() {
  const { name, treeName } = useProfile();
  const initial = (name || treeName).trim().charAt(0).toUpperCase();
  return (
    <UiLink
      href={ROUTES.me}
      aria-label="Your profile"
      className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-label font-bold"
    >
      {initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </UiLink>
  );
}

/**
 * The top of every app screen. On a desk it stays in view and carries the five destinations;
 * on a phone it is a slim strip (the logo and the status) that scrolls away with the page,
 * because the tab bar does the navigating there.
 */
export function TopBar({ section, desktop }: { section: RouteId; desktop: boolean }) {
  return (
    <header className="z-(--z-nav) border-b-2 border-line bg-mat pt-(--safe-t) lg:sticky lg:top-0">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-6 px-gutter lg:h-16">
        <Logo href={ROUTES.today} />
        {desktop ? (
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const current = item.id === section;
              return (
                <UiLink
                  key={item.id}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center rounded-pill px-4 text-label whitespace-nowrap',
                    current
                      ? 'bg-mat-deep font-bold text-ink'
                      : 'text-ink-3 fine:hover:bg-mat-deep fine:hover:text-ink',
                  )}
                >
                  {item.label}
                </UiLink>
              );
            })}
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <Status />
          {desktop ? <ProfileLink /> : null}
        </div>
      </div>
    </header>
  );
}
