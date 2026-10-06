'use client';

import { useSyncExternalStore } from 'react';
import {
  LINK_ERROR_COPY,
  decodeChallenge,
  decodeChallengeResult,
  isChallengeExpired,
  parseChallengeHash,
  type ChallengePayload,
  type ChallengeResultPayload,
} from '@/game';
import type { DayKey } from '@/lib/dates';

/** What the address bar of this page says: nothing, an invite, a result card, or a broken link. */
export type LinkView =
  | { kind: 'none' }
  | { kind: 'invite'; encoded: string; payload: ChallengePayload; expired: boolean }
  | { kind: 'result'; payload: ChallengeResultPayload }
  | { kind: 'broken'; message: string; expired: boolean };

const HASH_EVENT = 'touchgrass:hash';

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  window.addEventListener(HASH_EVENT, listener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
    window.removeEventListener(HASH_EVENT, listener);
  };
}

const readHash = (): string => window.location.hash;
const readServerHash = (): string => '';

/** The raw fragment of the address, kept in step with Back, edits and `clearLinkHash`. */
export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, readHash, readServerHash);
}

/** Forgets the link after the visitor has answered it, without adding a history entry. */
export function clearLinkHash(): void {
  try {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  } catch {
    // A sandboxed frame may refuse; the card then simply stays until the next visit.
    return;
  }
  window.dispatchEvent(new Event(HASH_EVENT));
}

/** Pure reading of a fragment, so a test can ask it without a browser. */
export function readLink(hash: string, today: DayKey): LinkView {
  if (hash.trim() === '' || hash === '#') return { kind: 'none' };
  const parsed = parseChallengeHash(hash);
  if (!parsed) return { kind: 'none' };
  if (parsed.kind === 'result') {
    const decoded = decodeChallengeResult(parsed.encoded);
    return decoded.ok
      ? { kind: 'result', payload: decoded.payload }
      : { kind: 'broken', message: LINK_ERROR_COPY[decoded.error], expired: false };
  }
  const decoded = decodeChallenge(parsed.encoded);
  if (!decoded.ok) {
    return {
      kind: 'broken',
      message: LINK_ERROR_COPY[decoded.error],
      expired: decoded.error === 'expired',
    };
  }
  return {
    kind: 'invite',
    encoded: parsed.encoded,
    payload: decoded.payload,
    expired: isChallengeExpired(decoded.payload, today),
  };
}
