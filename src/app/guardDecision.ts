import { normalizePath, ROUTES, routeInfo } from './routes';

/**
 * Who may see which route. Pure: the `<Guard>` component feeds it the hydrated store
 * and the current location, and acts on the answer.
 *
 * - `/` sends a user who has a tree to `/today`.
 * - App routes send a user without a tree to `/start`, and remember where they were going.
 * - `/start` sends a user who has a tree to wherever they were going, or `/today`.
 * - Everything else (methodology, privacy, the 404, workbenches) is open to anyone.
 */
export type GuardDecision =
  /** The saved state has not been read yet: show the splash, decide nothing. */
  | { kind: 'wait' }
  | { kind: 'allow' }
  | {
      kind: 'redirect';
      to: string;
      /** A destination to keep for after onboarding (path + query + hash). */
      remember?: string;
    };

export interface GuardInput {
  pathname: string;
  /** `location.search`, with or without the leading "?". */
  search?: string;
  /** `location.hash`, with or without the leading "#". */
  hash?: string;
  /** The saved state has been read. */
  hydrated: boolean;
  onboarded: boolean;
  /** A destination remembered by an earlier redirect to `/start`. */
  pending?: string | null;
  /** The user just erased everything on this device: an app route goes to the landing page. */
  justReset?: boolean;
}

const prefixed = (value: string | undefined, mark: string): string => {
  if (!value) return '';
  return value.startsWith(mark) ? value : `${mark}${value}`;
};

/**
 * Only in-app destinations survive onboarding: a same-origin path of an app route. Anything
 * else (another origin, `/start` itself, a public page) is dropped, so a crafted link can
 * never bounce a new user somewhere unexpected.
 */
export function safeDestination(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.includes('\\') || candidate.length > 2048) return null;
  return routeInfo(candidate).shell === 'app' ? candidate : null;
}

export function decideGuard(input: GuardInput): GuardDecision {
  const path = normalizePath(input.pathname);
  const { shell } = routeInfo(path);

  if (shell === 'bare') return { kind: 'allow' };
  // Public reading pages never wait for the store; only the landing page can redirect.
  if (shell === 'marketing' && path !== ROUTES.landing) return { kind: 'allow' };

  if (!input.hydrated) {
    // The landing page is pre-rendered and must paint at once; it is re-checked after hydration.
    return path === ROUTES.landing ? { kind: 'allow' } : { kind: 'wait' };
  }

  if (path === ROUTES.landing) {
    return input.onboarded ? { kind: 'redirect', to: ROUTES.today } : { kind: 'allow' };
  }

  if (shell === 'onboarding') {
    if (!input.onboarded) return { kind: 'allow' };
    const destination = safeDestination(input.pending);
    return { kind: 'redirect', to: destination ?? ROUTES.today };
  }

  // An app route.
  if (input.onboarded) return { kind: 'allow' };
  if (input.justReset) return { kind: 'redirect', to: ROUTES.landing };
  const here = `${path}${prefixed(input.search, '?')}${prefixed(input.hash, '#')}`;
  // A plain visit to Today is where onboarding ends anyway: nothing worth remembering.
  const remember = here === ROUTES.today ? undefined : (safeDestination(here) ?? undefined);
  return { kind: 'redirect', to: ROUTES.start, remember };
}

/** `sessionStorage` key of the destination kept across onboarding. A UI convenience, not game state. */
export const PENDING_DESTINATION_KEY = 'touch-grass:after-start';

export function readPendingDestination(): string | null {
  try {
    return safeDestination(window.sessionStorage.getItem(PENDING_DESTINATION_KEY));
  } catch {
    return null;
  }
}

export function writePendingDestination(destination: string | null): void {
  try {
    if (destination) window.sessionStorage.setItem(PENDING_DESTINATION_KEY, destination);
    else window.sessionStorage.removeItem(PENDING_DESTINATION_KEY);
  } catch {
    // Private windows may refuse storage; the user then simply lands on Today.
  }
}

/** Where onboarding hands over to: the remembered destination (once), or Today. */
export function takeAfterOnboardingDestination(): string {
  const destination = readPendingDestination();
  writePendingDestination(null);
  return destination ?? ROUTES.today;
}
