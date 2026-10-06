'use client';

import {
  ChartColumn,
  FileText,
  MessageCircle,
  ShieldCheck,
  Timer,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { CATEGORY_BY_ID } from '@/data/catalogue';
import { useActionStates, type ActionState } from '@/game';
import { formatDecimal } from '@/lib/format';
import { CATEGORY_ICON } from '@/ui';
import { CommandGroup, CommandItem, CommandPalette } from '@/ui/command';
import { NAV_ITEMS } from '../nav/navItems';
import { logLink, normalizePath, ROUTES, TOUCH_GRASS_LINK } from '../routes';
import { openCoach, useShellStore } from '../shellStore';
import { filterEntries, parseQuery, searchWords, usableQty, type Searchable } from './commands';

const LOG_RESULTS = 6;
const LOG_SUGGESTIONS = 4;

interface Command extends Searchable {
  label: string;
  icon: LucideIcon;
  href: string;
}

interface LogCommand extends Searchable {
  state: ActionState;
}

/** Everywhere a person can go, the five destinations first. */
const PLACES: readonly Command[] = [
  ...NAV_ITEMS.map((item) => ({
    id: `go-${item.id}`,
    label: item.label,
    icon: item.icon,
    href: item.href,
    keywords: `${item.label} ${item.id}`,
  })),
  {
    id: 'go-impact',
    label: 'Impact',
    icon: ChartColumn,
    href: ROUTES.impact,
    keywords: 'impact numbers co2 kg chart week',
  },
  {
    id: 'go-community',
    label: 'Community',
    icon: UsersRound,
    href: ROUTES.community,
    keywords: 'community journal share challenge friend',
  },
  {
    id: 'touch-grass',
    label: 'Take a Touch grass break',
    icon: Timer,
    href: TOUCH_GRASS_LINK,
    keywords: 'touch grass break timer outside walk rest',
  },
  {
    id: 'go-methodology',
    label: 'Methodology',
    icon: FileText,
    href: ROUTES.methodology,
    keywords: 'methodology sources factors how we estimate',
  },
  {
    id: 'go-privacy',
    label: 'Privacy',
    icon: ShieldCheck,
    href: ROUTES.privacy,
    keywords: 'privacy data device trackers',
  },
];

/**
 * The command palette: go anywhere, start a log ("bike 5" opens the bike action with 5 km
 * filled in), or ask Moss. It is its own chunk (cmdk comes with it), loaded on first open.
 */
export default function CommandMenu() {
  const router = useRouter();
  const pathname = normalizePath(usePathname() ?? '/');
  const open = useShellStore((state) => state.paletteOpen);
  const query = useShellStore((state) => state.paletteQuery);
  const setOpen = useShellStore((state) => state.setPaletteOpen);
  const setQuery = useShellStore((state) => state.setPaletteQuery);
  const actionStates = useActionStates();

  const parsed = useMemo(() => parseQuery(query), [query]);
  const words = useMemo(() => searchWords(parsed.text), [parsed.text]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const logEntries = useMemo<LogCommand[]>(
    () =>
      actionStates
        .filter((state) => !state.hidden)
        .map((state) => ({
          id: state.action.id,
          state,
          keywords: `${state.action.title} ${CATEGORY_BY_ID[state.action.category].label} ${state.action.unit}`,
        })),
    [actionStates],
  );

  const logResults = useMemo(() => {
    if (words.length > 0) return filterEntries(logEntries, words, LOG_RESULTS);
    // Nothing typed: the user's own regulars, then their focus areas.
    return [...logEntries]
      .sort(
        (a, b) =>
          b.state.recentLogs - a.state.recentLogs ||
          Number(b.state.inFocus) - Number(a.state.inFocus),
      )
      .slice(0, LOG_SUGGESTIONS);
  }, [logEntries, words]);

  const places = filterEntries(PLACES, words);
  const question = query.trim();

  const askMoss = () => {
    setOpen(false);
    if (pathname === ROUTES.coach) {
      // The conversation is the page here: hand the question to its composer.
      if (question) router.replace(`${ROUTES.coach}?q=${encodeURIComponent(question)}`);
      else openCoach();
      return;
    }
    openCoach(question || undefined);
  };

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => setOpen(next)}
      query={query}
      onQueryChange={setQuery}
      placeholder="Search actions and pages"
      shouldFilter={false}
    >
      {logResults.length > 0 ? (
        <CommandGroup heading="Log">
          {logResults.map(({ state }) => {
            const { action } = state;
            const qty = usableQty(parsed.qty, action) ?? state.quickQty;
            const Icon = CATEGORY_ICON[action.category];
            return (
              <CommandItem
                key={action.id}
                value={`log-${action.id}`}
                onSelect={() => go(logLink(action.id, qty))}
                leading={<Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
              >
                {action.title}
                <span className="font-normal text-ink-3">
                  {' '}
                  · {formatDecimal(qty, action.decimals)} {action.unit}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ) : null}

      {places.length > 0 ? (
        <CommandGroup heading="Go to">
          {places.map((place) => (
            <CommandItem
              key={place.id}
              value={place.id}
              onSelect={() => go(place.href)}
              leading={<place.icon size={20} strokeWidth={1.75} aria-hidden="true" />}
            >
              {place.label}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      <CommandGroup heading="Coach">
        <CommandItem
          value="ask-moss"
          onSelect={askMoss}
          leading={<MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />}
        >
          {question ? `Ask Moss: ${question}` : 'Ask Moss'}
        </CommandItem>
      </CommandGroup>
    </CommandPalette>
  );
}
