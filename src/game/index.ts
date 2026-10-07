/**
 * @/game — the rules engine, the persisted store, selectors, hooks and events.
 * Page teams: read this header first. Import only from this barrel.
 *
 * THREE CURRENCIES that never convert: XP = effort (level) · growth points = the tree ·
 * ≈ kg CO2e = estimated impact. A day is the local calendar day; "today" comes from the
 * store's clock, never from `Date.now()` in a component.
 *
 * ── ACTIONS — `gameActions.*` (or `useGameActions()`); stable, callable anywhere ──────────
 * Each returns its result synchronously; a refusal is `{ ok: false, reason, message? }`
 * and changes nothing. Every action goes through one path that settles the calendar,
 * applies the change atomically and emits typed events.
 *   onboard(input)                    seed-planting ceremony: profile, seed, ring 1, +25 XP
 *   scanLegacy() / declineLegacy()    old-app data: offer real logs, or leave them behind
 *   setOnboardingStep(n)              resume point of /start (0–7)
 *   updateProfile(patch)              name, tree name, species, region, heat, units, focus
 *   updateSettings(patch)             sound, haptics, motion, graphics, sky, celebrations,
 *                                     coach sharing, rest days (apply from next Monday)
 *   hideAction(id) / unhideAction(id) "Not for me"
 *   checkIn()                         the Water button; false when today is already watered
 *   logAction({ actionId, qty?, source?, inputs? })   log a catalogue action
 *   logCustom({ title, category, effort, co2eKg?, save? })   log a custom action
 *   logSavedCustom(id) / removeSavedCustom(id)        "My actions"
 *   undoLog(id)                       undo inside the 8-second window
 *   deleteLog(id)                     delete any log (today is re-scored, the past subtracts)
 *   claimQuest(id) / swapQuest(kind, slot)            claim once; one swap per period
 *   completeEpic(id, confirmed?) / updateEpic(id, patch) / pinEpic(id | null)
 *   openLesson(slug) / markLessonRead(slug) / completeLesson(slug, score) / flipMyth(n)
 *   setBaseline(answers, { useAsFocus? }) / clearBaseline()
 *   startTouchGrass(min) / signalTouchGrass(signal) / finishTouchGrass(outcome)
 *   addPost(input) / editPost(id, patch) / deletePost(id) / clearJournal()
 *   react(targetId, reaction)         a mark on this device (e.g. save an editorial post)
 *   createChallenge(input) / acceptChallenge(encoded) / dismissChallenge()
 *   recordShareExport()               a share card was exported (first one: Show & Tell)
 *   dismissNotice(id) / markRecapSeen(week) / markCoachMarksSeen() / markCoachPrivacyNoticeSeen()
 *   tick(now?)                        settle the calendar (the clock hook calls this)
 *   exportState(opts) / exportLogsCsv() / previewImport(text) / importState(text) / resetAll()
 *   storageUsedBytes() / legacyBackup() / deleteLegacyBackup()
 *   recoveryEntries() / discardRecovery()             unreadable saves, never wiped silently
 *
 * ── SANDBOX — a stand-in world (the demo) that can never touch the real save ─────────────
 *   game.enterSandbox(state)   show `state`; from here the game reads and saves a separate,
 *                              session-only namespace and ignores other tabs
 *   game.leaveSandbox()        forget it and bring back the real save, or "nothing planted"
 *   useIsSandbox()             true while one is showing (`runtime.sandbox`)
 *   createGame({ persist: false })   a game in memory only, for replaying the rules
 *
 * ── HOOKS — read models that keep their identity until something relevant changes ────────
 *   useGameHydrated()   saved state has been read (false on the server)
 *   useGameRuntime()    storage mode, save failure, recovery, legacy scan
 *   useGameNow() · useGameClockStatus()   the store clock; today, and a clock that was set back
 *   useIsOnboarded() · useProfile() · useSettings() · useOnboarding()
 *   useCustomActions() · useActivity()   "My actions"; the activity log, newest first
 *   useHud()            level, XP bar, streak, rain, ≈ kg — the shell's HUD
 *   useLevelInfo()      level, title, XP into level, XP to next
 *   useTreeStatus()     stage, stage progress, vitality + label, rings, status line, scene label
 *   useStreak()         streak, rain bank and progress, week strip, rest days
 *   useToday()          today's logs, ≈ kg, XP, acts to ring, growth left, daily fact
 *   useActionStates() · useActionState(id) · useQuickLog()   catalogue with today's caps
 *   useQuests() · useEpics()        dailies, weeklies, epics with progress and claim state
 *   useBadges() · useBadge(id)      33 badges with progress; unlocked island props
 *   useImpact() · useHistory() · useBaseline()   totals, categories, weeks, heatmap,
 *                                   equivalences, pace vs. starting line
 *   useLearn()          lesson states, recommended lesson, myths flipped
 *   useTouchGrass()     running break, cooldown, suggested duration, minutes outside
 *   useJournal() · useChallenge() · useNotices() · useRecap() · useIslandLog() · usePassport()
 *   useWorldSnapshot()  the WorldSnapshot for the Grove (props from badges, local hour)
 *   useGameEvent(type, handler) · useGameEvents(handler)     subscribe while mounted
 *   useGameClock()      mount ONCE in the shell: midnight rollover, minute tick, tab sync
 *   useTouchGrassTracker()   mount once: feeds a running break with visibility and input
 *   useGame(selector) · useGameState(selector)               escape hatches
 *
 * ── SELECTORS — pure `(game, now) => T`, memoised; for use outside React ─────────────────
 *   selectToday · selectLevelInfo · selectTreeStatus · selectStreak · selectTodaySummary
 *   selectActionStates · selectQuickLog · selectQuests · selectEpics · selectBadges
 *   selectImpact · selectHistory · selectBaseline · selectLearn · selectTouchGrass
 *   selectJournal · selectChallenge · selectNotices · selectRecap · selectPassport
 *   selectHud · selectClock · selectIslandLog
 *   selectWorldSnapshot(game, now)             -> WorldSnapshot
 *   selectCoachContext(game, now, options)     -> CoachContext-compatible object
 *   getCoachContext(options)                   the same, from the live store
 *   getGameState()                             the persisted state, outside React
 *
 * ── EVENTS — `gameEvents.on(type, fn)` / `.onBatch(fn)`; payloads in `events.ts` ─────────
 *   planted · checked-in · ring (drawn | closed | reopened) · action-logged · action-undone
 *   xp-gained · xp-removed · level-up · growth · stage-up · vitality-restored
 *   vitality-changed · streak · streak-milestone · streak-rested · freeze-used · rain-earned
 *   badge-unlocked · quest-progress · quest-claimable · quest-claimed · quest-voided
 *   quest-swapped · quests-rotated · clean-sweep · lesson-opened · lesson-completed
 *   myth-flipped · break-started · break-finished · break-cancelled · post-added
 *   post-edited · post-deleted · challenge-created · challenge-accepted
 *   challenge-completed · challenge-ended · baseline-set · focus-changed · day-rolled
 *   notice · legacy-imported · state-imported · state-reset
 *   `level-up`, `stage-up` and `ring` carry `first`: false means "regained after an undo"
 *   and must stay silent. `worldPulsesFor(events)` gives the pulses the Grove should play.
 *
 * ── PURE HELPERS worth knowing ──────────────────────────────────────────────────────────
 *   previewAction(game, input, day)   the sheet's honest preview: ≈ kg, XP, growth, caps
 *   kgPerUnit / estimateKg            regional estimate for an action
 *   computeBaseline / baselineSegments / suggestFocus / baselineReferences
 *   growthOf / stageOf / growthInfo / levelInfo / vitalityCopy
 *   pickEquivalences / paceHeadline / impactHeadline / noticeText
 *   decodeChallenge / challengeInviteText / challengeLink / parseChallengeHash
 *   scoreQuiz / dailyFact / weekStrip / weekRecap / todayAttachment / searchJournal
 *
 * QA: in development builds `window.__game.help()` lists time travel, grants and more.
 */

export * from './types';
export * from './economy';

// Events
export {
  gameEvents,
  createEventBus,
  worldPulsesFor,
  type GameEvent,
  type GameEventType,
  type GameEventOf,
  type GameEventBus,
  type XpReason,
  type CheckInVia,
} from './events';

// Store and actions
export {
  game,
  gameStore,
  gameActions,
  getGameState,
  createGame,
  startGameClock,
  type Game,
  type GameActions,
  type GameRuntime,
  type GameStore,
  type GameStoreState,
  type CreateGameOptions,
  type ClockHandle,
} from './store';
export {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  EXPORT_APP_ID,
  SANDBOX_PREFIX,
  SANDBOX_MARK_KEY,
} from './keys';
export {
  createMemoryStorage,
  type KeyValueStorage,
  type StorageMode,
  type RecoveryEntry,
} from './storage';
export {
  buildExport,
  exportFileName,
  logsToCsv,
  parseImport,
  CSV_COLUMNS,
  IMPORT_FAILURE_COPY,
  type ExportEnvelope,
  type ImportFailure,
  type ImportPreview,
  type ImportResult,
} from './persist';
export { validateState } from './schema';
export { createInitialState, isOnboarded, checkInvariants } from './state';

// Hooks
export * from './hooks';

// Selectors
export * from './selectors';

// Rules: levels, growth, vitality
export { LEVEL_TABLE, xpForLevel, levelOf, levelTitle, levelInfo, type LevelInfo } from './levels';
export {
  growthOf,
  stageOf,
  stageIndexOf,
  stageName,
  stageProgress,
  stageProgressLabel,
  growthInfo,
  growPulseStrength,
  type GrowthInfo,
  type StageName,
} from './growth';
export { vitalityValue, vitalityLabel, vitalityCopy, vitalityAfterMissed } from './vitality';

// Rules: scoring and logging
export {
  scoreDay,
  previewLog,
  actsOf,
  customXp,
  CUSTOM_ACTION_ID,
  type DayScore,
  type ScoredLog,
} from './scoring';
export {
  previewAction,
  actionAvailability,
  remainingUnits,
  lastUsedQty,
  canUndo,
  type ActionAvailability,
  type LogActionInput,
  type LogCustomInput,
  type LogPreview,
  type LogRefusal,
  type LogRefusalReason,
  type LogResult,
  type RemoveResult,
} from './logging';
export {
  kgPerUnit,
  estimateKg,
  gridIntensity,
  carKgPerKm,
  contextKgPerUnit,
  ledYearlyKgPerBulb,
  homeWorkingKg,
  isHeatAction,
  resolveVariant,
  decodeVariant,
  CARPOOL_PEOPLE,
  DEFAULT_CARPOOL_PEOPLE,
  COMMUTE_PRESETS_KM,
  DEFAULT_COMMUTE_KM,
  COMMUTE_MAX_KM,
  type KgContext,
  type KgEstimate,
  type LogInputs,
} from './co2';

// Rules: calendar
export {
  effectiveDay,
  isClockSkewed,
  isClockSuspect,
  weekStrip,
  markLabel,
  activeDaysIn,
  weekdayOf,
  restDaysOn,
  type WeekStripDay,
} from './calendar';

// Rules: quests and badges
export {
  evaluateCondition,
  conditionActions,
  drawDaily,
  drawWeekly,
  epicStatus,
  epicCooldownDays,
  type ClaimRefusal,
  type ClaimResult,
  type EpicStatus,
  type QuestProgress,
  type SwapRefusal,
  type SwapResult,
} from './quests';
export {
  badgeStatus,
  allBadgeStatuses,
  unlockedProps,
  badgeMetric,
  type BadgeStatus,
} from './badges';

// Rules: learn and Touch Grass
export {
  LESSONS,
  LESSON_SLUGS,
  DAILY_FACT_COUNT,
  dailyFact,
  scoreQuiz,
  isPass,
  lessonStatus,
  lessonProgress,
  recommendedLesson,
  type DailyFactRef,
  type LessonResult,
  type LessonStatus,
} from './lessons';
export {
  judgeBreak,
  breakXp,
  breakCooldownMin,
  type BreakFinishResult,
  type BreakOutcome,
  type BreakSignal,
  type BreakStartResult,
  type BreakStats,
  type BreakVerdict,
} from './touchGrass';

// Rules: starting line, pace, equivalences
export {
  BASELINE_SEGMENTS,
  BASELINE_SEGMENT_LABELS,
  computeBaseline,
  parseBaselineAnswers,
  baselineSegments,
  biggestLevers,
  suggestFocus,
  isLowFootprint,
  baselineReferences,
  keptActions,
  type BaselineReference,
  type BaselineSegmentShare,
} from './baseline';
export {
  computePace,
  paceHeadline,
  pacePercentLabel,
  habitsHeld,
  habitsHeldCopy,
  PACE_INFO,
  type HabitsHeld,
  type PaceResult,
} from './pace';
export {
  pickEquivalences,
  allEquivalences,
  equivalenceFor,
  type Equivalence,
} from './equivalences';

// Rules: community and recap
export {
  JOURNAL_TAGS,
  JOURNAL_PROMPT_COUNT,
  journalTagLabel,
  journalPromptIndex,
  todayAttachment,
  searchJournal,
  hasReaction,
  CHALLENGE_TEMPLATES,
  LINK_ERROR_COPY,
  challengeTemplate,
  encodeChallenge,
  decodeChallenge,
  encodeChallengeResult,
  decodeChallengeResult,
  parseChallengeHash,
  challengeLink,
  challengeInviteText,
  challengeResultText,
  challengeResultFor,
  challengeProgress,
  isChallengeExpired,
  type ChallengePayload,
  type ChallengeProgress,
  type ChallengeRefusal,
  type ChallengeResultPayload,
  type ChallengeTemplate,
  type CreateChallengeInput,
  type LinkError,
  type PostInput,
  type PostResult,
} from './community';
export {
  weekRecap,
  recapToShow,
  recapWeeks,
  quietWeekCopy,
  gpEarnedOn,
  type WeekRecap,
} from './recap';

// Engine: for tests, tools and anything that must run the rules without the store
export {
  transact,
  normalizeFocus,
  isSpecies,
  type OnboardInput,
  type OnboardResult,
  type ProfilePatch,
  type ProfileRefusal,
  type ProfileResult,
  type SettingsPatch,
  type BaselineOpResult,
  type TransactResult,
} from './engine';
export { scanLegacy, LEGACY_KEYS, type LegacyScan } from './legacy';
