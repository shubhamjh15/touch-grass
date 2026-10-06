import { BookOpen, Plus, Sprout, Target, UserRound, type LucideIcon } from 'lucide-react';
import { ROUTES, type RouteId } from '../routes';

export interface NavItem {
  id: RouteId;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * The five destinations, in the order of the desktop top bar. Impact, Community and the Coach
 * are reached from Me and from links inside pages; they have no nav item of their own.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'today', label: 'Today', href: ROUTES.today, icon: Sprout },
  { id: 'log', label: 'Log', href: ROUTES.log, icon: Plus },
  { id: 'quests', label: 'Quests', href: ROUTES.quests, icon: Target },
  { id: 'learn', label: 'Learn', href: ROUTES.learn, icon: BookOpen },
  { id: 'me', label: 'Me', href: ROUTES.me, icon: UserRound },
];

/** The phone tab bar puts Log in the middle, under the thumb. */
export const TAB_ITEMS: readonly NavItem[] = (
  ['today', 'quests', 'log', 'learn', 'me'] as const
).flatMap((id) => NAV_ITEMS.filter((item) => item.id === id));
