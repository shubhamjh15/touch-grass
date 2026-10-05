/**
 * Scoring one day of logs (product spec section 2.3). XP, growth points, the ring and
 * quests count *acts*, not log entries, so splitting a log into several never pays more.
 * `scoreDay` is pure and is run again after every undo or delete.
 */
import { ACTION_BY_ID, GROUP_BY_ID, type ActsRule } from '@/data/catalogue';
import {
  DAILY_GOAL,
  FULL_XP_ACTS,
  GP_BY_ACT,
  HALF_XP_ACTS,
  LOG_XP_DAILY_CAP,
  XP_CUSTOM_BY_EFFORT,
} from './economy';

export const CUSTOM_ACTION_ID = 'custom';
export const CUSTOM_GROUP_ID = 'custom';

/** The part of an action the scorer needs. */
export interface ScoringRule {
  id: string;
  xp: number;
  acts: ActsRule;
  maxActs: number;
  group: string | null;
}

/** The part of a log the scorer needs. */
export interface ScorableLog {
  actionId: string;
  qty: number;
  effort?: 1 | 2 | 3 | 4 | null;
}

export interface ScoredLog {
  rewardedActs: number;
  xp: number;
  gp: number;
}

export interface DayScore {
  /** One entry per input log, in the same order. */
  logs: ScoredLog[];
  rewardedActs: number;
  ringClosed: boolean;
  logXp: number;
  logGp: number;
  usedByAction: Readonly<Record<string, number>>;
  usedByGroup: Readonly<Record<string, number>>;
}

export function customXp(effort: 1 | 2 | 3 | 4 | null | undefined): number {
  return XP_CUSTOM_BY_EFFORT[(effort ?? 2) - 1] ?? XP_CUSTOM_BY_EFFORT[1];
}

/** The scoring rule for a log: the catalogue's, or the custom rule for anything else. */
export function scoringRuleFor(log: ScorableLog): ScoringRule {
  const action = ACTION_BY_ID.get(log.actionId);
  if (action) return action;
  const group = GROUP_BY_ID.get(CUSTOM_GROUP_ID);
  return {
    id: CUSTOM_ACTION_ID,
    xp: customXp(log.effort),
    acts: 'log',
    maxActs: group?.maxActs ?? 2,
    group: CUSTOM_GROUP_ID,
  };
}

/** How many acts a log is worth before any cap. */
export function actsOf(rule: Pick<ScoringRule, 'acts'>, qty: number): number {
  if (rule.acts === 'unit') return Math.max(0, Math.ceil(qty));
  if (rule.acts === 'log') return 1;
  return rule.acts;
}

/** Rewarded acts still available to a rule, given what the day has already used. */
export function roomFor(
  rule: ScoringRule,
  usedByAction: Readonly<Record<string, number>>,
  usedByGroup: Readonly<Record<string, number>>,
  position: number,
): number {
  const byAction = rule.maxActs - (usedByAction[rule.id] ?? 0);
  const groupCap = rule.group ? GROUP_BY_ID.get(rule.group)?.maxActs : undefined;
  const byGroup =
    rule.group && groupCap !== undefined
      ? groupCap - (usedByGroup[rule.group] ?? 0)
      : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(byAction, byGroup, HALF_XP_ACTS - position));
}

/** Scores the logs of ONE day, given in timestamp order. */
export function scoreDay(logs: readonly ScorableLog[]): DayScore {
  let position = 0;
  let logXp = 0;
  let logGp = 0;
  const usedByAction: Record<string, number> = {};
  const usedByGroup: Record<string, number> = {};
  const scored: ScoredLog[] = [];

  for (const log of logs) {
    const rule = scoringRuleFor(log);
    const wanted = actsOf(rule, log.qty);
    const rewarded = Math.max(
      0,
      Math.min(wanted, roomFor(rule, usedByAction, usedByGroup, position)),
    );
    let xp = 0;
    let gp = 0;
    for (let i = 0; i < rewarded; i += 1) {
      position += 1;
      const base = Math.floor(rule.xp * (position <= FULL_XP_ACTS ? 1 : 0.5));
      const paid = Math.min(base, LOG_XP_DAILY_CAP - logXp);
      xp += paid;
      logXp += paid;
      gp += GP_BY_ACT[position - 1] ?? 0;
    }
    logGp += gp;
    usedByAction[rule.id] = (usedByAction[rule.id] ?? 0) + rewarded;
    if (rule.group) usedByGroup[rule.group] = (usedByGroup[rule.group] ?? 0) + rewarded;
    scored.push({ rewardedActs: rewarded, xp, gp });
  }

  return {
    logs: scored,
    rewardedActs: position,
    ringClosed: position >= DAILY_GOAL,
    logXp,
    logGp,
    usedByAction,
    usedByGroup,
  };
}

/** What one more log of `candidate` would earn on top of the day so far. */
export function previewLog(dayLogs: readonly ScorableLog[], candidate: ScorableLog): ScoredLog {
  const score = scoreDay([...dayLogs, candidate]);
  return score.logs[score.logs.length - 1] ?? { rewardedActs: 0, xp: 0, gp: 0 };
}
