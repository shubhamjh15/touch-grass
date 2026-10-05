/**
 * Best-effort abuse protection: a token bucket per client and a global cap on
 * simultaneous upstream calls.
 *
 * Honest limitation: serverless instances do not share memory. Every warm
 * instance keeps its own buckets, a cold start resets them, and a determined
 * caller can spread requests across instances. This stops accidents and casual
 * abuse of a free-tier key; it is not a quota system. A shared store (Redis,
 * Vercel KV) is the upgrade path once the app has a real backend.
 */
import type { Clock } from './http.js';

export interface LimiterOptions {
  /** Requests a client may burst. */
  capacity: number;
  /** Sustained requests per hour per client. */
  perHour: number;
  /** Upstream calls allowed at once on this instance. */
  maxConcurrent: number;
  /** Distinct clients remembered before the oldest are forgotten. */
  maxClients?: number;
}

export type TakeResult = { ok: true } | { ok: false; retryAfterSec: number };

export interface RateLimiter {
  take(key: string): TakeResult;
  /** Returns a release function, or null when the instance is at its concurrency cap. */
  acquire(): (() => void) | null;
}

interface Bucket {
  tokens: number;
  updated: number;
}

export function createRateLimiter(options: LimiterOptions, clock: Clock): RateLimiter {
  const maxClients = options.maxClients ?? 5000;
  const refillPerMs = options.perHour / 3_600_000;
  const buckets = new Map<string, Bucket>();
  let active = 0;

  return {
    take(key) {
      const now = clock.now();
      const bucket = buckets.get(key) ?? { tokens: options.capacity, updated: now };
      bucket.tokens = Math.min(
        options.capacity,
        bucket.tokens + (now - bucket.updated) * refillPerMs,
      );
      bucket.updated = now;
      // Re-insert so the Map's iteration order is least-recently-used first.
      buckets.delete(key);
      if (bucket.tokens < 1) {
        buckets.set(key, bucket);
        const waitMs = refillPerMs > 0 ? (1 - bucket.tokens) / refillPerMs : 3_600_000;
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
      }
      bucket.tokens -= 1;
      buckets.set(key, bucket);
      while (buckets.size > maxClients) {
        const oldest = buckets.keys().next();
        if (oldest.done) break;
        buckets.delete(oldest.value);
      }
      return { ok: true };
    },
    acquire() {
      if (active >= options.maxConcurrent) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
  };
}
