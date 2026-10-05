/** Defaults that read the real process: the only place the functions touch `process`. */
import { readNumber, type Clock } from './http.js';
import { createRateLimiter, type RateLimiter } from './limits.js';
import type { Env } from './providers.js';

export function defaultEnv(): Env {
  return (globalThis as { process?: { env?: Env } }).process?.env ?? {};
}

export function defaultLimiter(env: Env, clock: Clock): RateLimiter {
  return createRateLimiter(
    {
      capacity: 8,
      perHour: readNumber(env.AI_RATE_PER_HOUR, 30, 1, 10_000),
      maxConcurrent: readNumber(env.AI_MAX_CONCURRENCY, 8, 1, 200),
    },
    clock,
  );
}
