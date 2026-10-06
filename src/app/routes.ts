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
  /** Opens the demo world: a grown tree in a sandbox that never touches saved data. */
  demo: '/demo',
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
  /** `/demo?leave=home|start`: end the demo world and go home, or on to planting a tree. */
  demoLeave: 'leave',
} as const;

/** `/log?a=bike-instead-of-car&q=5`: the Log page opens its sheet prefilled; it never logs by itself. */
export function logLink(actionId: string, qty?: number, source?: LogLinkSource): string {
  const query = new URLSearchParams({ [PARAMS.logAction]: actionId });
  if (qty !== undefined && Number.isFinite(qty) && qty > 0) query.set(PARAMS.logQty, String(qty));
  if (source) query.set(PARAMS.logSource, source);
  return `${ROUTES.log}?${query.toString()}`;
}

/**
 * Ends the demo world. `home` lands on the landing page and `start` on the planting flow;
 * someone who has a tree of their own lands on their Today either way.
 */
export function demoLeaveLink(to: 'home' | 'start'): string {
  return `${ROUTES.demo}?${PARAMS.demoLeave}=${to}`;
}

/** The Touch grass break, hosted by Today. */
export const TOUCH_GRASS_LINK = `${ROUTES.today}?${PARAMS.touchGrass}=1`;

/**
 * Which chrome a path gets.
 * - `app`: the product (top bar or tab bar, HUD); needs a planted tree.
 * - `marketing`: public pages; reachable by anyone.
 * - `onboarding`: `/start`, no navigation at all.
 * - `bare`: workbenches and anything unknown (the 404 picks its own chrome).
 */
export type ShellKind = 'app' | 'marketing' | 'onboarding' | 'bare';

/**
 * How an app route frames the grove (bible 3.3 and 3.5).
 * - `bleed`: the page owns a full-height stage (Today).
 * - `rail`: the shell shows the companion plate in the left rail at `lg` and up.
 * - `reading`: one calm column, the world docked.
 */
export type AppFrame = 'bleed' | 'rail' | 'reading';

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
  | 'demo'
  | 'unknown';

export interface RouteInfo {
  id: RouteId;
  shell: ShellKind;
  /** Only for `app` routes. */
  frame: AppFrame;
  /** Short name: the nav label and the document title. */
  title: string;
  /** The top-level destination this path belongs to, for the current-page mark in the nav. */
  section: RouteId;
}

const APP_ROUTES: Record<string, Pick<RouteInfo, 'id' | 'frame' | 'title'>> = {
  [ROUTES.today]: { id: 'today', frame: 'bleed', title: 'Today' },
  [ROUTES.log]: { id: 'log', frame: 'rail', title: 'Log' },
  [ROUTES.quests]: { id: 'quests', frame: 'rail', title: 'Quests' },
  [ROUTES.learn]: { id: 'learn', frame: 'rail', title: 'Learn' },
  [ROUTES.impact]: { id: 'impact', frame: 'rail', title: 'Impact' },
  [ROUTES.community]: { id: 'community', frame: 'rail', title: 'Community' },
  [ROUTES.coach]: { id: 'coach', frame: 'rail', title: 'Moss' },
  [ROUTES.me]: { id: 'me', frame: 'rail', title: 'Me' },
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
  if (app) return { ...app, shell: 'app', section: app.id };
  if (path.startsWith(`${ROUTES.learn}/`) && path.split('/').length === 3) {
    return { id: 'lesson', shell: 'app', frame: 'reading', title: 'Lesson', section: 'learn' };
  }
  if (path === ROUTES.landing) {
    return { id: 'landing', shell: 'marketing', frame: 'bleed', title: 'Home', section: 'landing' };
  }
  if (path === ROUTES.methodology) {
    return {
      id: 'methodology',
      shell: 'marketing',
      frame: 'reading',
      title: 'Methodology',
      section: 'methodology',
    };
  }
  if (path === ROUTES.privacy) {
    return {
      id: 'privacy',
      shell: 'marketing',
      frame: 'reading',
      title: 'Privacy',
      section: 'privacy',
    };
  }
  if (path === ROUTES.start) {
    return {
      id: 'start',
      shell: 'onboarding',
      frame: 'bleed',
      title: 'Plant your tree',
      section: 'start',
    };
  }
  if (path === ROUTES.demo) {
    // No chrome and no guard: it is the door between the real save and the demo world.
    return { id: 'demo', shell: 'bare', frame: 'reading', title: 'Demo world', section: 'demo' };
  }
  return { id: 'unknown', shell: 'bare', frame: 'reading', title: 'Not found', section: 'unknown' };
}
