/** Every URL in the app. Link with these instead of string literals. */
export const ROUTES = {
  landing: '/',
  start: '/start',
  today: '/today',
  log: '/log',
  quests: '/quests',
  learn: '/learn',
  lesson: (lessonId: string) => `/learn/${lessonId}`,
  impact: '/impact',
  community: '/community',
  coach: '/coach',
  me: '/me',
  methodology: '/methodology',
  privacy: '/privacy',
} as const;

/** Where a prefilled log came from; stored on the log entry. */
export type LogLinkSource = 'coach' | 'quest' | 'lesson' | 'recap';

/** Query parameters the pages and the shell agree on. One place, so nobody types them twice. */
export const PARAMS = {
  /** `/log?a=<actionId>`: open the log sheet prefilled with that catalogue action. */
  logAction: 'a',
  /** `/log?a=…&q=<qty>`: the quantity to prefill. */
  logQty: 'q',
  /** `/log?a=…&src=<coach|quest|lesson|recap>`: who suggested it. */
  logSource: 'src',
  /** `/log?custom=1`: open the custom-action flow. */
  logCustom: 'custom',
  /** `/today?break=1`: open the Touch grass break sheet. */
  touchGrass: 'break',
  /** `?coach=1` on any app route: open the coach drawer (the shell handles and removes it). */
  coach: 'coach',
} as const;

/** `/log?a=bike-instead-of-car&q=5`: the Log page opens its sheet prefilled; it never logs by itself. */
export function logLink(actionId: string, qty?: number, source?: LogLinkSource): string {
  const query = new URLSearchParams({ [PARAMS.logAction]: actionId });
  if (qty !== undefined && Number.isFinite(qty) && qty > 0) query.set(PARAMS.logQty, String(qty));
  if (source) query.set(PARAMS.logSource, source);
  return `${ROUTES.log}?${query.toString()}`;
}

/** The custom-action flow of the Log page. */
export const CUSTOM_LOG_LINK = `${ROUTES.log}?${PARAMS.logCustom}=1`;

/** The Touch grass break, hosted by Today. */
export const TOUCH_GRASS_LINK = `${ROUTES.today}?${PARAMS.touchGrass}=1`;

/**
 * Which chrome a path gets.
 * - `app`: the product (top bar or tab bar); needs a planted tree.
 * - `marketing`: public pages; reachable by anyone.
 * - `onboarding`: `/start`, no navigation at all.
 * - `bare`: workbenches and anything unknown (the 404 picks its own chrome).
 */
export type ShellKind = 'app' | 'marketing' | 'onboarding' | 'bare';

export type RouteId =
  | 'landing'
  | 'start'
  | 'today'
  | 'log'
  | 'quests'
  | 'learn'
  | 'lesson'
  | 'impact'
  | 'community'
  | 'coach'
  | 'me'
  | 'methodology'
  | 'privacy'
  | 'unknown';

export interface RouteInfo {
  id: RouteId;
  shell: ShellKind;
  /** The destination whose nav item is marked current while this path shows. */
  section: RouteId;
}

const APP_ROUTES: Record<string, { id: RouteId; section: RouteId }> = {
  [ROUTES.today]: { id: 'today', section: 'today' },
  [ROUTES.log]: { id: 'log', section: 'log' },
  [ROUTES.quests]: { id: 'quests', section: 'quests' },
  [ROUTES.learn]: { id: 'learn', section: 'learn' },
  // Impact, Community and the Coach are reached from Me, so Me stays marked while they show.
  [ROUTES.impact]: { id: 'impact', section: 'me' },
  [ROUTES.community]: { id: 'community', section: 'me' },
  [ROUTES.coach]: { id: 'coach', section: 'me' },
  [ROUTES.me]: { id: 'me', section: 'me' },
};

const MARKETING_ROUTES: Record<string, RouteId> = {
  [ROUTES.landing]: 'landing',
  [ROUTES.methodology]: 'methodology',
  [ROUTES.privacy]: 'privacy',
};

/** `/learn/` and `/learn` are the same place. */
export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

/** What the shell needs to know about a path. Unknown paths are `bare` (the 404). */
export function routeInfo(pathname: string): RouteInfo {
  const path = normalizePath(pathname);
  const app = APP_ROUTES[path];
  if (app) return { ...app, shell: 'app' };
  if (path.startsWith(`${ROUTES.learn}/`) && path.split('/').length === 3) {
    return { id: 'lesson', shell: 'app', section: 'learn' };
  }
  const marketing = MARKETING_ROUTES[path];
  if (marketing) return { id: marketing, shell: 'marketing', section: marketing };
  if (path === ROUTES.start) return { id: 'start', shell: 'onboarding', section: 'start' };
  return { id: 'unknown', shell: 'bare', section: 'unknown' };
}
