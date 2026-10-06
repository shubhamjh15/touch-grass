/**
 * Where the flow hands over once the tree is planted. A visitor who followed a deep link
 * (a friend's challenge, say) was sent here first; the shell remembered where they were
 * going, and this module reads that back so the link still works after the ceremony.
 */
import { readPendingDestination } from '@/app/guardDecision';
import { ROUTES, takeAfterOnboardingDestination } from '@/app/shell';
import { decodeChallenge, parseChallengeHash } from '@/game';

export interface PendingChallenge {
  /** Who sent it, when the link says so: their name, or else their tree's. */
  from: string | null;
}

/** The challenge invitation the visitor arrived with, if any. Reading it changes nothing. */
export function pendingChallenge(): PendingChallenge | null {
  const destination = readPendingDestination();
  if (!destination) return null;
  const hashAt = destination.indexOf('#');
  if (hashAt < 0) return null;
  const parsed = parseChallengeHash(destination.slice(hashAt));
  if (!parsed || parsed.kind !== 'invite') return null;
  const decoded = decodeChallenge(parsed.encoded);
  // A damaged link is the Community page's to explain; here it is still "a link is waiting".
  if (!decoded.ok) return { from: null };
  return { from: decoded.payload.n ?? decoded.payload.t ?? null };
}

/** True when planting leads somewhere other than Today. */
export function hasPendingDestination(): boolean {
  const destination = readPendingDestination();
  return destination !== null && destination !== ROUTES.today;
}

/** The route to open after the ceremony. Reading it forgets it. */
export function takeDestination(): string {
  return takeAfterOnboardingDestination();
}
