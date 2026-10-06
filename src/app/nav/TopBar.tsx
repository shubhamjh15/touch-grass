'use client';

import { motion } from 'framer-motion';
import { ChevronDown, Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useProfile } from '@/game';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { Avatar, DropdownMenu, LeafMark, OfflineBanner, SPRINGS, UiLink } from '@/ui';
import { ROUTES, type RouteId } from '../routes';
import { openCoach, openPalette } from '../shellStore';
import { Hud } from './Hud';
import { TOP_LINKS, TOP_LINKS_COMPACT } from './navItems';

const noSubscription = () => () => undefined;
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** "⌘" on Apple keyboards, "Ctrl" everywhere else. */
export function useModifierLabel(): string {
  const apple = useSyncExternalStore(noSubscription, isApple, () => false);
  return apple ? '⌘' : 'Ctrl';
}

/** The logo tile and the product name. */
export function Logo({
  href,
  className,
  nameClassName,
}: {
  href: string;
  className?: string;
  /** Lets a tight bar fold the wordmark away; the link keeps its accessible name. */
  nameClassName?: string;
}) {
  return (
    <UiLink
      href={href}
      aria-label={`${BRAND.name}, home`}
      className={cn('flex shrink-0 items-center gap-2.5 rounded-ctl', className)}
    >
      <span
        data-dock-target=""
        className="grid size-[38px] -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1"
      >
        <LeafMark size={22} />
      </span>
      <span className={cn('text-h3 whitespace-nowrap', nameClassName)}>{BRAND.name}</span>
    </UiLink>
  );
}

const LINK =
  'relative inline-flex h-10 items-center rounded-ctl border-3 border-transparent px-3.5 text-label whitespace-nowrap';

function TopLink({
  id,
  href,
  label,
  current,
  className,
}: {
  id: RouteId;
  href: string;
  label: string;
  current: boolean;
  className?: string;
}) {
  return (
    <UiLink
      href={href}
      // What the demo's tour points at.
      data-tour={`nav-${id}`}
      aria-current={current ? 'page' : undefined}
      className={cn(LINK, current ? 'font-bold' : 'fine:hover:bg-mat-deep', className)}
    >
      {current ? (
        // One pill for the whole bar: it slides to the new item instead of blinking across.
        <motion.span
          layoutId="top-nav-pill"
          transition={SPRINGS.sheet}
          aria-hidden="true"
          className="absolute -inset-[3px] -rotate-[1.5deg] rounded-ctl border-3 border-ink bg-yellow flat-3"
        />
      ) : null}
      <span className="relative">{label}</span>
    </UiLink>
  );
}

/**
 * The desktop top bar (`lg` and up): logo, the six destinations, the HUD, and the palette,
 * coach and tree buttons. Below 1440 px Impact and Community fold into a More menu.
 */
export function TopBar({ section }: { section: RouteId }) {
  const profile = useProfile();
  const modifier = useModifierLabel();
  const overflow = TOP_LINKS.slice(TOP_LINKS_COMPACT);
  const overflowCurrent = overflow.some((item) => item.id === section);

  return (
    <header className="fixed inset-x-6 top-4 z-(--z-nav) mx-auto hidden h-16 max-w-[1392px] items-center gap-1.5 rounded-lg border-4 border-ink bg-white px-3.5 shadow-3 lg:flex">
      <Logo
        href={ROUTES.today}
        className="mr-1 min-[1180px]:mr-3"
        nameClassName="max-[1179px]:sr-only"
      />

      <nav aria-label="Main" className="flex items-center gap-1">
        {TOP_LINKS.map((item, index) => (
          <TopLink
            key={item.id}
            id={item.id}
            href={item.href}
            label={item.label}
            current={item.id === section}
            className={index >= TOP_LINKS_COMPACT ? 'hidden min-[1440px]:inline-flex' : undefined}
          />
        ))}
        <span className="min-[1440px]:hidden">
          <DropdownMenu
            label="More pages"
            align="start"
            items={overflow.map((item) => ({
              id: item.id,
              label: item.label,
              icon: item.icon,
              href: item.href,
              current: item.id === section,
            }))}
            trigger={
              <button
                type="button"
                data-tour="nav-more"
                className={cn(
                  LINK,
                  'cursor-pointer gap-1',
                  overflowCurrent
                    ? '-rotate-[1.5deg] border-ink bg-yellow font-bold flat-3'
                    : 'fine:hover:bg-mat-deep',
                )}
              >
                More
                <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            }
          />
        </span>
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2.5">
        <OfflineBanner className="shrink-0" />
        <Hud />
        <button
          type="button"
          onClick={() => openPalette()}
          aria-label="Search and commands"
          aria-keyshortcuts="Control+K Meta+K"
          className="relative inline-flex h-8 shrink-0 hard cursor-pointer items-center gap-1.5 rounded-sm border-2 border-ink bg-white px-2 font-mono text-[0.6875rem] font-semibold whitespace-nowrap lift-2 after:absolute after:-inset-1.5"
        >
          <Search size={14} strokeWidth={2.5} aria-hidden="true" />
          <span aria-hidden="true">{modifier} K</span>
        </button>
        {/* The wrapper has no box of its own: it only names the button for the demo's tour. */}
        <span data-tour="nav-coach" className="contents">
          <Avatar kind="moss" size={44} label="Ask Moss, your coach" onClick={() => openCoach()} />
        </span>
        <Avatar
          kind="tree"
          species={profile.species ?? undefined}
          size={44}
          label={`${profile.treeName || 'Your tree'}: passport and settings`}
          href={ROUTES.me}
          data-tree-button=""
        />
      </div>
    </header>
  );
}
