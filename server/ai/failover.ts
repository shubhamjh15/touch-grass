/**
 * Shared failover bookkeeping: which chain entries to try, which are cooling
 * down after a failure, what to tell the client when all of them failed, and
 * what to log (provider, model, status: never content and never keys).
 */
import type { Clock } from './http.js';
import { errorResponse, SAFE_MESSAGES } from './http.js';
import type { ChainEntry } from './providers.js';
import type { UpstreamFailure } from './upstream.js';

export interface Cooldowns {
  isCooling(entry: ChainEntry): boolean;
  mark(entry: ChainEntry, failure: UpstreamFailure): void;
}

const key = (entry: ChainEntry): string => `${entry.keyRef}|${entry.provider}|${entry.model}`;

/**
 * In-memory only, like the rate limiter: each serverless instance learns about
 * a rate-limited model on its own, which is enough to stop hammering it.
 */
export function createCooldowns(clock: Clock): Cooldowns {
  const until = new Map<string, number>();
  return {
    isCooling(entry) {
      const end = until.get(key(entry));
      if (end === undefined) return false;
      if (end <= clock.now()) {
        until.delete(key(entry));
        return false;
      }
      return true;
    },
    mark(entry, failure) {
      if (failure.kind === 'aborted') return;
      let ms = 10_000;
      if (failure.rateLimited)
        ms = Math.min(120_000, Math.max(5_000, (failure.retryAfterSec ?? 30) * 1000));
      else if (failure.status === 401 || failure.status === 403) ms = 300_000;
      else if (failure.gone) ms = 600_000;
      until.set(key(entry), clock.now() + ms);
      if (until.size > 200) {
        const oldest = until.keys().next();
        if (!oldest.done) until.delete(oldest.value);
      }
    },
  };
}

/** Entries that are not cooling down come first; cooling ones are a last resort. */
export function orderCandidates(
  chain: readonly ChainEntry[],
  cooldowns: Cooldowns,
  maxAttempts: number,
): ChainEntry[] {
  const ready = chain.filter((entry) => !cooldowns.isCooling(entry));
  const cooling = chain.filter((entry) => cooldowns.isCooling(entry));
  return [...ready, ...cooling].slice(0, maxAttempts);
}

export function logFailure(
  log: (message: string) => void,
  entry: ChainEntry,
  failure: UpstreamFailure,
): void {
  const parts = [`[ai] ${entry.label} / ${entry.model} failed: ${failure.kind}`];
  if (failure.status !== undefined) parts.push(`status ${failure.status}`);
  if (failure.rateLimited) parts.push('rate limited');
  if (failure.gone)
    parts.push('the model id may be retired: update server/ai/providers.ts or set AI_MODEL');
  if (failure.status === 401 || failure.status === 403) parts.push(`check ${entry.keyRef}`);
  log(parts.join(', '));
}

/** The response when every attempt failed. Chooses the most useful honest code. */
export function failureResponse(failures: readonly UpstreamFailure[]): Response {
  const limited = failures.filter((failure) => failure.rateLimited);
  if (limited.length > 0 && limited.length === failures.length) {
    const retryAfterSec = Math.min(...limited.map((failure) => failure.retryAfterSec ?? 30));
    return errorResponse('rate_limited', SAFE_MESSAGES.rate_limited, {
      retryAfterSec: Math.max(1, retryAfterSec),
    });
  }
  if (failures.length > 0 && failures.every((failure) => failure.kind === 'timeout'))
    return errorResponse('timeout', SAFE_MESSAGES.timeout);
  return errorResponse('upstream_unavailable', SAFE_MESSAGES.upstream_unavailable);
}
