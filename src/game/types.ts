/**
 * The persisted game state (product spec section 13.4) and the records inside it.
 * Everything not listed here is derived and must never be stored: level, title,
 * growth, stage, world props, quest and badge progress, pace, the weekly recap.
 */
import type { BadgeTier } from '@/data/badges';
import type { BaselineQuestionId, BaselineSegment, CategoryId } from '@/data/catalogue';
import type { DayKey } from '@/lib/dates';
import type { Species, WorldMotion, WorldPreference } from '@/world/contract';

export type { CategoryId, DayKey, Species, BadgeTier };

/** `W` + the Monday's DayKey. */
export type WeekKey = string;
/** A catalogue id, or `custom`. */
export type ActionId = string;
/** One of the grid region ids; `WORLD` by default. */
export type RegionId = string;

export type DayMark = 'full' | 'ring' | 'rain' | 'rest' | 'missed';
export type VitalityState = 'thriving' | 'thirsty' | 'dormant' | 'waking';
export type HeatSource = 'unknown' | 'gas' | 'electric' | 'heat-pump' | 'none';
export type Units = 'metric' | 'imperial';
export type LogSource =
  'log' | 'quick' | 'coach' | 'quest' | 'lesson' | 'recap' | 'custom' | 'legacy';
export type LogKind = 'swap' | 'keep' | 'unrated';
export type LogEstimate = 'factor' | 'ai' | 'none';
export type LogCadence = 'recurring' | 'occasional';
export type LegacyStatus = 'none' | 'offered' | 'imported' | 'declined';
export type ReturnedFrom = 'rain' | 'missed' | 'dormant' | null;
/** What happened to the rain bank when a day's ring closed, so re-opening it can step back. */
export type RingRain = 'none' | 'progress' | 'cloud';

export interface Profile {
  /** At most 20 characters; never leaves the device. */
  name: string;
  /** At most 16 characters. */
  treeName: string;
  species: Species;
  /** uint32, fixed at planting; the world's seed. */
  userSeed: number;
  plantedDay: DayKey;
  region: RegionId;
  heat: HeatSource;
  units: Units;
  /** 1 to 3 unique categories. */
  focus: CategoryId[];
}

export interface Onboarding {
  /** 0 to 8, the resume point. */
  step: number;
  completedAt: number | null;
  coachMarksSeen: boolean;
  legacy: LegacyStatus;
}

export interface Settings {
  /** Weekdays 0 (Sunday) to 6, at most 3. */
  restDays: number[];
  restDaysPending: number[] | null;
  /** The Monday the pending set takes effect. */
  restDaysFrom: DayKey | null;
  hiddenActions: ActionId[];
  sound: boolean;
  haptics: boolean;
  motion: WorldMotion;
  graphics: WorldPreference;
  sky: 'local' | 'day';
  celebrations: 'full' | 'subtle';
  shareStatsWithCoach: boolean;
}

export interface DayRecord {
  checkInTs: number;
  ringClosed: boolean;
  cleanSweep: boolean;
  breakRewarded: boolean;
  journalRewarded: boolean;
  returnedFrom: ReturnedFrom;
  /** The ring-closed celebration has played; a re-closed ring stays silent. */
  ringCelebrated: boolean;
  ringRain: RingRain;
}

export interface LogEntry {
  id: string;
  ts: number;
  /** Computed at `ts`; frozen. */
  day: DayKey;
  tzOffsetMin: number;
  actionId: ActionId;
  /** Evidence variant id, `people:3` for a shared ride, `commute:30:on` for a home-working day. */
  variant: string | null;
  title: string;
  emoji: string;
  category: CategoryId;
  qty: number;
  unit: string;
  /** `null` = not quantified. */
  co2eKg: number | null;
  kgLow: number | null;
  kgHigh: number | null;
  estimate: LogEstimate;
  factorsVersion: string;
  kind: LogKind;
  cadence: LogCadence;
  rewardedActs: number;
  xp: number;
  gp: number;
  source: LogSource;
  /** Effort tier of a custom action; decides its XP. */
  effort: 1 | 2 | 3 | 4 | null;
}

export interface BreakEntry {
  id: string;
  startTs: number;
  endTs: number;
  day: DayKey;
  plannedMin: number;
  keptMin: number;
  awayMs: number;
  kept: boolean;
  outcome: 'outside' | 'rested' | 'none';
  xp: number;
  gp: number;
}

export interface ActiveBreak {
  startTs: number;
  plannedMin: number;
  awayMs: number;
  /** Last moment the user was known to be at the screen; `null` while the page is hidden. */
  lastVisibleTs: number | null;
  hiddenSinceTs: number | null;
}

export interface QuestPeriod<K extends string = string> {
  key: K;
  slots: [string, string, string];
  swapsUsed: number;
  swapOffsets: [number, number, number];
}

export type QuestKind = 'daily' | 'weekly' | 'epic';

export interface QuestClaim {
  questId: string;
  kind: QuestKind;
  /** The day key, the week key, or `epic`. */
  period: string;
  ts: number;
  xp: number;
  auto: boolean;
}

export interface EpicProgress {
  checklist: boolean[];
  note: string;
  claimedTs: number | null;
}

export interface QuestsState {
  daily: QuestPeriod<DayKey> | null;
  weekly: QuestPeriod<WeekKey> | null;
  claims: QuestClaim[];
  epics: Record<string, EpicProgress>;
  pinnedEpic: string | null;
  lastSelfAttestedTs: number | null;
}

export interface BadgeProgress {
  tier: BadgeTier;
  earned: { tier: BadgeTier; ts: number }[];
}

export type QuizScore = 0 | 1 | 2 | 3;

export interface LessonProgress {
  openedTs: number | null;
  readTs: number | null;
  attempts: number;
  bestScore: QuizScore;
  firstAttemptScore: QuizScore | null;
  passedTs: number | null;
}

export interface LearnOpen {
  ts: number;
  day: DayKey;
  kind: 'lesson' | 'myth';
  id: string;
}

export type BaselineAnswers = Record<BaselineQuestionId, string>;
export type BaselineTonnes = Record<BaselineSegment | 'total', number>;

export interface BaselineResult {
  takenDay: DayKey;
  region: RegionId;
  modelVersion: 1;
  answers: BaselineAnswers;
  tonnes: BaselineTonnes;
}

export interface JournalNote {
  id: string;
  ts: number;
  day: DayKey;
  text: string;
  tag: string | null;
  attachment: string | null;
  editedTs: number | null;
}

export interface SavedCustomAction {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  effort: 1 | 2 | 3 | 4;
  co2eKg: number | null;
  estimate: 'ai' | 'none';
  qty: number;
  unit: string;
}

export interface ChallengeState {
  templateId: string;
  role: 'creator' | 'friend';
  startDay: DayKey;
  days: 7;
  category: CategoryId | null;
  /** The challenger's display name, when the link carried one. */
  from: string | null;
  fromTree: string | null;
  message: string | null;
  completedTs: number | null;
}

export interface ChallengeRecord {
  templateId: string;
  startDay: DayKey;
  done: number;
  of: number;
  success: boolean;
}

export type NoticeKind =
  | 'rain-return'
  | 'streak-rested'
  | 'woke-up'
  | 'auto-claimed'
  | 'challenge-ended'
  | 'legacy-imported';

/** A one-time message waiting to be shown, e.g. "It rained while you were away". */
export interface Notice {
  id: string;
  kind: NoticeKind;
  ts: number;
  day: DayKey;
  data: Record<string, string | number>;
}

export interface ActivityEntry {
  ts: number;
  day: DayKey;
  kind: string;
  text: string;
}

export interface GameState {
  schemaVersion: 1;
  contentVersion: string;
  factorsVersion: string;

  profile: Profile;
  onboarding: Onboarding;
  settings: Settings;

  clock: {
    /** Last settled day; days never move backwards. */
    today: DayKey;
    /** Newest stored event, for the future guard. */
    lastEventTs: number;
  };

  /** Lifetime total, a non-negative integer. */
  xp: number;

  tree: {
    gp: number;
    /** Lifetime active days; the world's `ageDays`. */
    rings: number;
    fullRings: number;
    vitality: VitalityState;
    /** Consecutive missed days ending yesterday. */
    missed: number;
  };

  streak: {
    current: number;
    best: number;
    milestones: number[];
  };

  rain: {
    bank: number;
    progress: number;
    lastRefillWeek: WeekKey | null;
    gifts: number[];
  };

  marks: Record<DayKey, DayMark>;
  days: Record<DayKey, DayRecord>;

  logs: LogEntry[];
  breaks: BreakEntry[];
  activeBreak: ActiveBreak | null;

  quests: QuestsState;
  badges: Record<string, BadgeProgress>;

  learn: {
    lessons: Record<string, LessonProgress>;
    mythsFlipped: number[];
    opens: LearnOpen[];
  };

  baseline: {
    current: BaselineResult | null;
    history: BaselineResult[];
  };

  journal: JournalNote[];
  /** Marks the user left on this device (saved editorial posts, pinned notes). Never a count of people. */
  reactions: Record<string, string[]>;
  customActions: SavedCustomAction[];

  challenge: {
    active: ChallengeState | null;
    lastRewardWeek: WeekKey | null;
    history: ChallengeRecord[];
  };

  activity: ActivityEntry[];
  notices: Notice[];

  seen: {
    messages: string[];
    recapWeek: WeekKey | null;
    coachPrivacyNotice: boolean;
    /** Highest level and stage already celebrated; regaining one after an undo is silent. */
    maxLevel: number;
    maxStage: number;
    shareExports: number;
  };
}
