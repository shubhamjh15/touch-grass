import {
  BookOpen,
  ChartColumn,
  FileText,
  ListChecks,
  MessageCircle,
  Search,
  ShieldCheck,
  Sprout,
  Target,
  Timer,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES, TOUCH_GRASS_LINK, type RouteId } from '../routes';

export interface NavItem {
  id: RouteId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line for the More sheet and the palette. */
  hint: string;
  /** The letter after `G` that jumps here. */
  key: string;
}

/** Every destination of the app, in the order of the desktop top bar (bible 9.3, string 1). */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'today',
    label: 'Today',
    href: ROUTES.today,
    icon: Sprout,
    hint: 'Your grove and the day',
    key: 't',
  },
  {
    id: 'log',
    label: 'Log',
    href: ROUTES.log,
    icon: ListChecks,
    hint: 'Stick an action on',
    key: 'l',
  },
  {
    id: 'quests',
    label: 'Quests',
    href: ROUTES.quests,
    icon: Target,
    hint: 'Daily, weekly, epics',
    key: 'q',
  },
  {
    id: 'learn',
    label: 'Learn',
    href: ROUTES.learn,
    icon: BookOpen,
    hint: 'Short lessons and myths',
    key: 'e',
  },
  {
    id: 'impact',
    label: 'Impact',
    href: ROUTES.impact,
    icon: ChartColumn,
    hint: 'Your numbers, in context',
    key: 'i',
  },
  {
    id: 'community',
    label: 'Community',
    href: ROUTES.community,
    icon: UsersRound,
    hint: 'Journal and challenges',
    key: 'c',
  },
  {
    id: 'coach',
    label: 'Moss',
    href: ROUTES.coach,
    icon: MessageCircle,
    hint: 'Ask your coach',
    key: 'o',
  },
  {
    id: 'me',
    label: 'Me',
    href: ROUTES.me,
    icon: UserRound,
    hint: 'Passport and settings',
    key: 'm',
  },
];

const byId = (id: RouteId): NavItem => {
  const item = NAV_ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`No nav item for route "${id}"`);
  return item;
};

/** Desktop top bar: all six at `xl`; the first four plus a More menu between `lg` and `xl`. */
export const TOP_LINKS: readonly NavItem[] = (
  ['today', 'log', 'quests', 'learn', 'impact', 'community'] as const
).map(byId);
export const TOP_LINKS_COMPACT = 4;

/** Mobile tab bar, left and right of the Log sticker. */
export const TAB_LINKS_LEFT: readonly NavItem[] = (['today', 'quests'] as const).map(byId);
export const TAB_LINKS_RIGHT: readonly NavItem[] = (['learn'] as const).map(byId);

/** Sections reachable only through the More sheet on a phone: More is current while one is showing. */
export const MORE_SECTIONS: readonly RouteId[] = ['impact', 'community', 'coach', 'me'];

export interface MoreEntry {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  href?: string;
  /** Handled by the sheet itself (coach drawer, palette). */
  command?: 'coach' | 'palette';
  tone?: 'yellow';
}

/** The More sheet, in the bible's order (4.9). */
export const MORE_ENTRIES: readonly MoreEntry[] = [
  { ...byId('impact'), id: 'impact' },
  { ...byId('community'), id: 'community' },
  { id: 'coach', label: 'Moss', hint: 'Ask your coach', icon: MessageCircle, command: 'coach' },
  { ...byId('me'), id: 'me' },
  {
    id: 'search',
    label: 'Search',
    hint: 'Find an action or a page',
    icon: Search,
    command: 'palette',
  },
  {
    id: 'touch-grass',
    label: 'Touch grass',
    hint: 'Take a break outside',
    icon: Timer,
    href: TOUCH_GRASS_LINK,
    tone: 'yellow',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    hint: 'How we estimate',
    icon: FileText,
    href: ROUTES.methodology,
  },
  {
    id: 'privacy',
    label: 'Privacy',
    hint: 'What stays on this device',
    icon: ShieldCheck,
    href: ROUTES.privacy,
  },
];
