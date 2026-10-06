'use client';

import { motion } from 'framer-motion';
import { Menu, Plus, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore, type MouseEvent } from 'react';
import { useToday } from '@/game';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/hooks';
import { UiLink } from '@/ui';
import { ROUTES, type RouteId } from '../routes';
import { useShellStore } from '../shellStore';
import { MORE_SECTIONS, TAB_LINKS_LEFT, TAB_LINKS_RIGHT } from './navItems';

const TEXT_ENTRY =
  'input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit],[type=file],[type=color]),textarea,[contenteditable="true"]';

function subscribeTyping(onChange: () => void): () => void {
  document.addEventListener('focusin', onChange);
  document.addEventListener('focusout', onChange);
  return () => {
    document.removeEventListener('focusin', onChange);
    document.removeEventListener('focusout', onChange);
  };
}

/** A touch keyboard is (very probably) covering the bottom of the screen. */
function isTouchTyping(): boolean {
  const active = document.activeElement;
  if (!active || !active.matches(TEXT_ENTRY)) return false;
  // Inside a sheet the bar is covered anyway; hiding it there would only make it flicker.
  if (active.closest('[role="dialog"]')) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function Tab({
  href,
  label,
  icon: Icon,
  current,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
}) {
  return (
    <UiLink
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-14 w-full max-w-[78px] flex-col items-center gap-1 rounded-ctl text-tab',
        current ? 'font-bold text-ink' : 'text-ink-2',
      )}
    >
      <TabPill icon={Icon} current={current} />
      {label}
    </UiLink>
  );
}

function TabPill({ icon: Icon, current }: { icon: LucideIcon; current: boolean }) {
  return (
    <span className="relative grid h-[30px] w-[46px] place-items-center">
      {current ? (
        <motion.span
          layoutId="tab-pill"
          transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 1 }}
          aria-hidden="true"
          className="absolute inset-0 -rotate-3 rounded-pill border-2 border-ink bg-yellow shadow-1"
        />
      ) : null}
      <Icon size={20} strokeWidth={current ? 2.6 : 2.2} aria-hidden="true" className="relative" />
    </span>
  );
}

/**
 * The centre slot: a die-cut green sticker that sits half above the bar. It goes to Log (the
 * quick-log surface); on Log itself it puts the cursor in the search field instead.
 */
function LogSticker({ onLog }: { onLog: boolean }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const nothingLoggedToday = useToday().logs.length === 0;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onLog) return;
    event.preventDefault();
    const search = document.querySelector<HTMLElement>(
      '#main input[type="search"], #main [role="searchbox"], #main [data-log-search]',
    );
    if (search) search.focus();
    else router.replace(ROUTES.log);
  };

  return (
    <UiLink
      href={ROUTES.log}
      onClick={onClick}
      aria-label="Log an action"
      aria-current={onLog ? 'page' : undefined}
      className="group relative z-(--z-fab) -mt-[42px] flex w-full max-w-[78px] flex-col items-center gap-1.5 rounded-[22px] text-tab font-bold text-ink"
    >
      <motion.span
        // One small wiggle every 12 s until the first log of the day; never after.
        animate={
          nothingLoggedToday && !reduced && !onLog ? { rotate: [-4, -6, -2, -4] } : { rotate: -4 }
        }
        transition={
          nothingLoggedToday && !reduced && !onLog
            ? { duration: 0.5, repeat: Infinity, repeatDelay: 11.5, ease: 'easeInOut' }
            : { duration: 0 }
        }
        className="grid size-[66px] diecut place-items-center rounded-[22px] border-4 border-ink bg-green transition-[translate] duration-(--dur-press) dc-4 group-active:translate-x-0.5 group-active:translate-y-0.5"
      >
        <Plus size={32} strokeWidth={3} aria-hidden="true" />
      </motion.span>
      <span aria-hidden="true">Log</span>
    </UiLink>
  );
}

/**
 * The mobile tab bar (below `lg`): Today, Quests, the Log sticker, Learn and More. It steps
 * aside while a touch keyboard is open and whenever a page asks the chrome to hide.
 */
export function TabBar({ section }: { section: RouteId }) {
  const moreOpen = useShellStore((state) => state.moreOpen);
  const setMoreOpen = useShellStore((state) => state.setMoreOpen);
  const typing = useSyncExternalStore(subscribeTyping, isTouchTyping, () => false);
  const moreCurrent = MORE_SECTIONS.includes(section);

  if (typing) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-(--z-nav) grid h-[calc(64px+var(--safe-b))] grid-cols-5 items-start justify-items-center border-t-3 border-ink bg-white px-[max(4px,var(--safe-l))] pt-2 pb-(--safe-b) lg:hidden"
    >
      {TAB_LINKS_LEFT.map((item) => (
        <Tab {...item} key={item.id} current={item.id === section} />
      ))}
      <LogSticker onLog={section === 'log'} />
      {TAB_LINKS_RIGHT.map((item) => (
        <Tab {...item} key={item.id} current={item.id === section} />
      ))}
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={cn(
          'flex h-14 w-full max-w-[78px] cursor-pointer flex-col items-center gap-1 rounded-ctl text-tab',
          moreCurrent ? 'font-bold text-ink' : 'text-ink-2',
        )}
      >
        <TabPill icon={Menu} current={moreCurrent} />
        More
      </button>
    </nav>
  );
}
