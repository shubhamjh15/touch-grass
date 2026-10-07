/**
 * Every constant of the economy in one place (product spec, appendix E). XP is effort,
 * growth points (GP) are the tree, kilograms are impact: the three never convert.
 */

/** Rewarded acts that close the day ring. */
export const DAILY_GOAL = 3;
/** Acts 1 to 6 of a day pay full XP. */
export const FULL_XP_ACTS = 6;
/** Acts 7 to 12 pay half; later acts are not rewarded. */
export const HALF_XP_ACTS = 12;
export const LOG_XP_DAILY_CAP = 150;

export const XP_CEREMONY = 25;
export const XP_CHECK_IN = 10;
export const XP_RING_CLOSED = 10;
export const XP_CLEAN_SWEEP = 15;
/** 10 to 19 kept minutes. */
export const XP_BREAK_SHORT = 15;
/** 20 or more kept minutes. */
export const XP_BREAK_LONG = 25;
export const XP_LESSON_PASS = 30;
/** 3 out of 3 on the first attempt. */
export const XP_LESSON_PERFECT_BONUS = 10;
export const XP_MYTH_FLIP = 5;
/** First note of 20 or more characters per day. */
export const XP_JOURNAL_NOTE = 5;
/** One per week. */
export const XP_CHALLENGE = 40;
export const XP_CUSTOM_BY_EFFORT = [8, 10, 12, 15] as const;
export const XP_BADGE_BY_TIER = [20, 40, 80] as const;
export const XP_BADGE_SECRET = 50;
export const STREAK_MILESTONES = [
  [3, 15],
  [7, 30],
  [14, 50],
  [30, 100],
  [50, 150],
  [100, 300],
  [200, 500],
  [365, 1000],
] as const;

export const GP_CHECK_IN = 8;
export const GP_BY_ACT = [5, 4, 3, 2, 1, 1] as const;
export const GP_RING_CLOSED = 4;
/** First kept Touch Grass break of the day. */
export const GP_SUNLIGHT = 2;
export const GP_DAILY_CAP = 30;
/** (GP, growth) anchors, sitting exactly on the structural gates the world builds its tree around. */
export const GROWTH_TABLE = [
  [0, 0],
  [8, 0.03],
  [32, 0.07],
  [150, 0.12],
  [600, 0.35],
  [2000, 0.65],
  [4500, 0.8],
  [9000, 0.9],
  [18000, 0.96],
] as const;
export const STAGES = [
  ['Seed', 0],
  ['Sprout', 8],
  ['Seedling', 32],
  ['Sapling', 150],
  ['Young tree', 600],
  ['Mature tree', 2000],
  ['Grand tree', 4500],
  ['Elder', 9000],
  ['Ancient', 18000],
] as const;

export const RAIN_START = 1;
export const RAIN_CAP = 2;
export const RAIN_WEEKLY_REFILL_TO = 1;
export const RAIN_FULL_RINGS_PER_CLOUD = 5;
export const RAIN_STREAK_GIFTS = [7, 30, 100, 365] as const;
export const REST_DAYS_MAX = 3;
/** Shorter streaks end without a message. */
export const STREAK_REST_MESSAGE_MIN = 3;
export const VITALITY_THIRSTY_START = 0.7;
export const VITALITY_THIRSTY_STEP = 0.08;
export const VITALITY_WAKING = 0.6;
export const DORMANT_AFTER_MISSED = 7;

export const QUEST_EPOCH_DAY = '2026-01-01';
export const QUEST_EPOCH_WEEK = '2025-12-29';
export const SELF_ATTESTED_EPIC_COOLDOWN_DAYS = 7;
export const FLIGHT_SWAPS_PER_30_DAYS = 4;
export const CUSTOM_AI_KG_PER_LOG_MAX = 2;
export const CUSTOM_AI_KG_PER_DAY_MAX = 5;
export const PACE_WINDOW_DAYS = 28;
export const PACE_MIN_SPAN_DAYS = 14;
export const PACE_MIN_ACTIVE_DAYS = 7;
export const BREAK_AWAY_SHARE = 0.7;
export const BREAK_MIN_GAP_MIN = 30;
export const FUTURE_GUARD_MS = 5 * 60 * 1000;
/**
 * A clock that reads more than this many days past the last settled day is not believed
 * on its own: the calendar waits for a real action before it closes that many days.
 */
export const SUSPECT_JUMP_DAYS = 21;
/** No trip moves the local date back further than this; anything more is a corrected clock. */
export const BACKWARD_TOLERANCE_DAYS = 2;

// ── Limits the spec states in prose ─────────────────────────────────────────
/** An identical log inside this window is a double tap and is ignored. */
export const DOUBLE_TAP_MS = 2000;
/** How long the undo toast offers to peel a fresh log off again. */
export const UNDO_WINDOW_MS = 8000;
export const KEEP_PHONE_COOLDOWN_DAYS = 365;
export const BREAK_DURATIONS_MIN = [10, 20, 30, 45] as const;
/** The shortest break that counts, also when a longer one is ended early. */
export const BREAK_MIN_KEPT_MIN = 10;
export const BREAK_LONG_MIN = 20;
/** Visible time without any input for this long counts as time away. */
export const BREAK_IDLE_MS = 60 * 1000;
/** Breaks per day that feed quests and the Grass Toucher badge. */
export const BREAKS_COUNTED_PER_DAY = 2;
export const JOURNAL_REWARD_MIN_CHARS = 20;
export const JOURNAL_MAX_CHARS = 500;
export const SAVED_CUSTOM_ACTIONS_MAX = 12;
export const CUSTOM_TITLE_MIN = 3;
export const CUSTOM_TITLE_MAX = 80;
export const NAME_MAX = 20;
export const TREE_NAME_MAX = 16;
export const FOCUS_MAX = 3;
export const ACTIVITY_MAX = 500;
export const LEARN_OPENS_KEEP_DAYS = 14;
export const LESSON_PASS_SCORE = 2;
export const LESSON_QUESTIONS = 3;
export const MYTH_COUNT = 10;
export const CHALLENGE_DAYS = 7;
export const CHALLENGE_ACCEPT_DAYS = 14;
export const CHALLENGE_LINK_MAX_CHARS = 300;
export const DEFAULT_FOCUS = ['eat', 'move'] as const;
/** Baselines at or below this many tonnes get the "already living light" variant. */
export const LOW_FOOTPRINT_TONNES = 3;

/** Bumped when quests, lessons or badges change in a way saved state must notice. */
export const CONTENT_VERSION = '2026.10';
/** Version of the persisted schema; `migrate` handles every older one. */
export const SCHEMA_VERSION = 1;
