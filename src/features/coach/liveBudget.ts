/**
 * The device's hourly budget for the live coach (product spec 8.4: 30 messages per hour
 * per device, on top of the proxy's own limit per IP). Over budget, the request is never
 * made: the client raises the same "rate limited" failure the server would, so the
 * built-in coach answers and the user is told when Moss is back.
 */
import { AiError, type CoachClient } from '@/ai';

export const LIVE_BUDGET = { max: 30, windowMs: 60 * 60 * 1000 } as const;

export type BudgetCheck = { ok: true; left: number } | { ok: false; retryAfterSec: number };

/** `sends` are the moments of earlier live requests, in any order. */
export function checkLiveBudget(sends: readonly number[], now: number): BudgetCheck {
  const recent = sends
    .filter((moment) => moment > now - LIVE_BUDGET.windowMs && moment <= now)
    .sort((a, b) => a - b);
  if (recent.length < LIVE_BUDGET.max) return { ok: true, left: LIVE_BUDGET.max - recent.length };
  // The request that frees a slot is the oldest one still counted against the budget.
  const freesAt = (recent[recent.length - LIVE_BUDGET.max] ?? now) + LIVE_BUDGET.windowMs;
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((freesAt - now) / 1000)) };
}

export interface BudgetDeps {
  now: () => number;
  /** Every live request this device remembers. */
  sends: () => readonly number[];
  record: (moment: number) => void;
}

/** Wraps a coach client so each live request first spends from the device's budget. */
export function withLiveBudget(base: CoachClient, deps: BudgetDeps): CoachClient {
  return {
    getAiStatus: (options) => base.getAiStatus(options),
    resetStatus: () => base.resetStatus?.(),
    async streamChat(params) {
      const now = deps.now();
      const check = checkLiveBudget(deps.sends(), now);
      if (!check.ok) {
        throw new AiError('rate_limited', 'The hourly budget for the live coach is used up.', {
          retryAfterSec: check.retryAfterSec,
        });
      }
      deps.record(now);
      return base.streamChat(params);
    },
  };
}
