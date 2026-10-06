/** Every destination of the product and what its tab should say (the `title` of each route file). */
export interface RouteSpec {
  path: string;
  /** The document title, without the brand suffix. */
  title: string;
  /** The link's name in the navigation. */
  nav?: string;
}

export const APP_ROUTES: readonly RouteSpec[] = [
  { path: '/today', title: 'Today', nav: 'Today' },
  { path: '/log', title: 'Log', nav: 'Log' },
  { path: '/quests', title: 'Quests', nav: 'Quests' },
  { path: '/learn', title: 'Learn', nav: 'Learn' },
  { path: '/impact', title: 'Impact', nav: 'Impact' },
  { path: '/community', title: 'Community', nav: 'Community' },
  { path: '/coach', title: 'Coach' },
  { path: '/me', title: 'Me' },
];

export const PUBLIC_ROUTES: readonly RouteSpec[] = [
  { path: '/methodology', title: 'Methodology' },
  { path: '/privacy', title: 'Privacy' },
];

export const BRAND_SUFFIX = ' · Touch Grass';

export const LANDING_TITLE = /^Touch Grass — /;

export function titleOf(route: Pick<RouteSpec, 'title'>): string {
  return `${route.title}${BRAND_SUFFIX}`;
}
