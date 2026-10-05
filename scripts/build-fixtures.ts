/**
 * Builds scripts/fixtures/*.json: saved game states for screenshots and end-to-end tests.
 * Every state is produced by playing the real engine, so a fixture can never drift from
 * the schema or contain numbers the rules could not produce. Each file maps localStorage
 * keys to values, which is what scripts/shot.mjs seeds a page with.
 *
 *   node scripts/build-fixtures.mjs [--date YYYY-MM-DD]
 *
 * States are anchored to a day (today unless --date is given): "day12" means the twelfth
 * day is that day. Re-run the script when a fixture has gone stale, otherwise the tree
 * in it will simply be a few days thirstier than its name says.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { DAILY_QUEST_BY_ID, EPICS, WEEKLY_QUEST_BY_ID } from '@/data/quests';
import { addPost, createChallenge } from '@/game/community';
import type { LogInputs } from '@/game/co2';
import {
  dismissNotice,
  markCoachMarksSeen,
  setBaseline,
  updateSettings,
  water,
} from '@/game/engine';
import { growthInfo } from '@/game/growth';
import { STORAGE_KEYS } from '@/game/keys';
import { LESSON_SLUGS, completeLesson, flipMyth, openLesson } from '@/game/lessons';
import { levelOf } from '@/game/levels';
import { logAction, logCustom } from '@/game/logging';
import { parseStoredGame, serializeStoredGame } from '@/game/persist';
import {
  claimEpic,
  claimQuest,
  dailyProgress,
  epicStatus,
  isClaimed,
  weeklyProgress,
} from '@/game/quests';
import { selectWorldSnapshot } from '@/game/selectors';
import { checkInvariants, createInitialState } from '@/game/state';
import { type GameSession, localTime, plantedSession } from '@/game/testkit';
import { finishBreak, signalBreak, startBreak } from '@/game/touchGrass';
import type { GameState } from '@/game/types';
import { addDays, dayKey, type DayKey } from '@/lib/dates';
import { createRng, type Rng } from '@/lib/rng';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'fixtures');
const MINUTE = 60_000;

const dateArg = process.argv.indexOf('--date');
const anchor: DayKey = dateArg > 0 ? (process.argv[dateArg + 1] ?? '') : dayKey(Date.now());
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
  console.error(`--date expects YYYY-MM-DD, got "${anchor}"`);
  process.exit(2);
}
/** "Now" for every fixture: mid-morning of the anchor day. */
const NOW = localTime(anchor, 10, 30);

type LogSpec = readonly [actionId: string, qty?: number, inputs?: LogInputs];

interface DayScript {
  logs?: readonly LogSpec[];
  /** Claim every finished quest on the board at the end of the day. */
  claim?: boolean;
  lesson?: readonly [slug: string, score: number];
  myths?: readonly number[];
  breakMin?: number;
  note?: readonly [text: string, tag?: string];
  custom?: readonly [title: string, category: 'stuff' | 'nature' | 'waste', effort: 1 | 2 | 3 | 4];
}

const BASELINE = {
  diet: 'medium-meat',
  transportMode: 'car-alone',
  weeklyDistance: '75-150',
  flights: 'short-1-2',
  homeEnergy: 'gas-typical',
  shopping: 'regular',
};

function fail(message: string): never {
  throw new Error(`build-fixtures: ${message}`);
}

/** Plays one day. `until` cuts the day short, for a "today" that is still in progress. */
function playDay(
  session: GameSession,
  day: DayKey,
  script: DayScript,
  until = Number.POSITIVE_INFINITY,
): void {
  const at = (hour: number, minute = 0) => Math.min(localTime(day, hour, minute), until);
  session.at(at(8, 10), water);
  (script.logs ?? []).forEach(([actionId, qty, inputs], index) => {
    const result = session.at(at(8, 20) + index * 7 * MINUTE, (ctx) =>
      logAction(ctx, { actionId, qty, inputs, source: index === 0 ? 'quick' : 'log' }),
    );
    if (!result.ok) fail(`${day}: ${actionId} refused (${result.reason})`);
  });
  if (script.custom) {
    const [title, category, effort] = script.custom;
    session.at(at(11), (ctx) => logCustom(ctx, { title, category, effort, save: true }));
  }
  if (script.breakMin) {
    const start = at(12, 30);
    session.at(start, (ctx) => startBreak(ctx, script.breakMin ?? 10));
    session.at(start + 20_000, (ctx) => signalBreak(ctx, 'hidden'));
    session.at(start + script.breakMin * MINUTE, (ctx) => finishBreak(ctx, 'outside'));
  }
  for (const myth of script.myths ?? [])
    session.at(at(18, 40) + myth, (ctx) => flipMyth(ctx, myth));
  if (script.lesson) {
    const [slug, score] = script.lesson;
    session.at(at(19), (ctx) => openLesson(ctx, slug));
    session.at(at(19, 5), (ctx) => completeLesson(ctx, slug, score));
  }
  if (script.note) {
    const [text, tag] = script.note;
    session.at(at(19, 30), (ctx) => addPost(ctx, { text, tag, attachToday: true }));
  }
  if (script.claim) claimFinished(session, at(21));
}

function claimFinished(session: GameSession, now: number): void {
  const { daily, weekly, claims } = session.state.quests;
  const today = session.state.clock.today;
  for (const id of daily?.slots ?? []) {
    if (!daily || !DAILY_QUEST_BY_ID.has(id) || isClaimed(claims, 'daily', daily.key, id)) continue;
    if (dailyProgress(session.state, id, daily.key).done)
      session.at(now, (ctx) => claimQuest(ctx, id));
  }
  for (const id of weekly?.slots ?? []) {
    if (!weekly || !WEEKLY_QUEST_BY_ID.has(id) || isClaimed(claims, 'weekly', weekly.key, id))
      continue;
    if (weeklyProgress(session.state, id, weekly.key).done)
      session.at(now + 1, (ctx) => claimQuest(ctx, id));
  }
  for (const epic of EPICS) {
    if (epic.attestation === null && epicStatus(session.state, epic, today).claimable) {
      session.at(now + 2, (ctx) => claimEpic(ctx, epic.id, false));
    }
  }
}

function plant(
  start: DayKey,
  seed: number,
  name = 'Maya',
  species: 'oak' | 'cherry' | 'pine' = 'oak',
): GameSession {
  return plantedSession(localTime(start, 8), { name, treeName: 'Fern', species, userSeed: seed });
}

/** Shows up at `now`, as if the app had just been opened, and marks the tour as seen. */
function openApp(session: GameSession, now = NOW): GameState {
  session.at(now, markCoachMarksSeen);
  // A regular has read yesterday's messages; only what today's opening raised stays unread.
  for (const notice of session.state.notices) {
    if (notice.day < session.state.clock.today)
      session.at(now, (ctx) => dismissNotice(ctx, notice.id));
  }
  const problems = checkInvariants(session.state);
  if (problems.length > 0) fail(`invariants broken: ${problems.join('; ')}`);
  return session.state;
}

// ── day1: the ceremony has just finished, nothing logged yet ─────────────────
function day1(): GameState {
  const session = plantedSession(NOW, {
    name: 'Maya',
    treeName: 'Fern',
    species: 'oak',
    userSeed: 101,
  });
  return session.state;
}

// ── day12: the state the mock-ups show ───────────────────────────────────────
// An oak named Fern, level 5, a 12-day streak, about 48 kg avoided, today's ring one act short.
function day12(): GameState {
  const start = addDays(anchor, -11);
  const session = plant(start, 20261006);
  session.at(localTime(start, 8, 5), (ctx) => setBaseline(ctx, BASELINE));
  const meal: LogSpec = ['plant-based-meal', 1];
  const bus: LogSpec = ['bus-instead-of-car', 10];
  // Quantities carry the kilograms; the number of acts carries the XP. Both are tuned
  // to the mock-ups and checked below, so a rule change cannot silently move them.
  const longBus: LogSpec = ['bus-instead-of-car', 20];
  const plan: DayScript[] = [
    { logs: [meal, longBus] },
    { logs: [meal, longBus] },
    { logs: [meal, longBus, ['food-waste-avoided', 1]] },
    { logs: [meal, longBus], lesson: ['the-blanket', 2] },
    { logs: [meal, bus, ['second-hand-tshirt', 1]] },
    {
      logs: [['vegetarian-day', 1]],
      note: ['Lentil bolognese was easier than I expected.', 'win'],
    },
    { logs: [meal, ['walk-cycle-instead-of-car', 5]] },
    { logs: [meal, longBus] },
    { logs: [meal, longBus] },
    { logs: [meal, longBus] },
    // Yesterday's finished quests were claimed by hand, so today opens without a summary.
    { logs: [meal, bus, ['repair-instead-of-replace', 1]], claim: true },
  ];
  plan.forEach((script, index) => playDay(session, addDays(start, index), script));
  playDay(session, anchor, { logs: [meal, bus] }, NOW - 20 * MINUTE);
  const state = openApp(session);

  const kg = state.logs.reduce(
    (sum, log) => sum + (log.estimate === 'factor' ? (log.co2eKg ?? 0) : 0),
    0,
  );
  const level = levelOf(state.xp);
  const facts = `level ${level} (${state.xp} XP), streak ${state.streak.current}, ≈ ${kg.toFixed(1)} kg`;
  if (
    level !== 5 ||
    state.streak.current !== 12 ||
    state.tree.rings !== 12 ||
    Math.abs(kg - 48) > 1.5
  ) {
    fail(`day12 must be level 5, a 12-day streak and about 48 kg; it is ${facts}`);
  }
  return state;
}

/** A believable varied day for the longer histories, chosen by a seeded generator. */
function variedDay(rng: Rng, index: number): DayScript {
  const weekday = index % 7;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
  const logs: LogSpec[] = [];
  if (weekday === 5 && rng() < 0.5) logs.push(['vegetarian-day', 1]);
  else logs.push(['plant-based-meal', rng() < 0.3 ? 2 : 1]);
  logs.push(
    pick<LogSpec>([
      ['bus-instead-of-car', 10],
      ['bus-instead-of-car', 5],
      ['walk-cycle-instead-of-car', 3],
      ['train-metro-instead-of-car', 10],
      ['walk-cycle-instead-of-car', 5],
    ]),
  );
  if (rng() < 0.7) {
    logs.push(
      pick<LogSpec>([
        ['refuse-single-use-bottle', 1],
        ['shorter-shower', 2],
        ['standby-off', 1],
        ['line-dry-instead-of-tumble', 1],
        ['wash-cold-instead-of-40', 1],
        ['compost-food-waste', 0.5],
        ['recycle-paper', 0.5],
        ['tap-off-while-brushing', 1],
        ['tend-plants', 1],
        ['refuse-single-use-cup', 1],
      ]),
    );
  }
  if (rng() < 0.12)
    logs.push(
      pick<LogSpec>([
        ['borrow-instead-of-buy', 1],
        ['pass-it-on', 1],
        ['litter-pick', 1],
        ['climate-conversation', 1],
      ]),
    );
  return {
    logs,
    claim: rng() < 0.6,
    breakMin: weekday === 5 || rng() < 0.08 ? 20 : undefined,
  };
}

interface HistoryOptions {
  days: number;
  seed: number;
  /** Day indexes on which the user did not show up. */
  skip?: (index: number) => boolean;
  lessonsEvery?: number;
}

function history({ days, seed, skip, lessonsEvery = 9 }: HistoryOptions): GameSession {
  const start = addDays(anchor, -(days - 1));
  const session = plant(start, seed);
  session.at(localTime(start, 8, 5), (ctx) => setBaseline(ctx, BASELINE, { useAsFocus: true }));
  const rng = createRng('fixture', seed);
  const notes = [
    'Cycled the short way round. Faster than the bus, honestly.',
    'Batch-cooked chickpea curry. Four dinners sorted.',
    'Forgot my bottle today. Borrowed a glass instead.',
    'Talked to my flatmate about the heating. We agreed on 19 °C.',
    'Farmers market for the first time in months.',
  ];
  let lessonIndex = 0;
  for (let index = 0; index < days; index += 1) {
    const day = addDays(start, index);
    const script = variedDay(rng, index);
    if (skip?.(index)) continue;
    const isToday = index === days - 1;
    if (!isToday && index % lessonsEvery === 3 && lessonIndex < LESSON_SLUGS.length) {
      script.lesson = [LESSON_SLUGS[lessonIndex] as string, lessonIndex % 3 === 0 ? 2 : 3];
      lessonIndex += 1;
    }
    if (!isToday && index % 11 === 6)
      script.note = [
        notes[((index / 11) % notes.length) | 0] as string,
        index % 2 ? 'win' : 'idea',
      ];
    if (!isToday && index % 17 === 9) script.myths = [((index / 17) | 0) + 1];
    if (isToday) playDay(session, day, { logs: script.logs?.slice(0, 2) }, NOW - 15 * MINUTE);
    else playDay(session, day, script);
  }
  return session;
}

// ── day45: six weeks in, one wobble behind them, a challenge running ─────────
function day45(): GameState {
  // Sundays off (rain usually covers them), and four days away in week four.
  const session = history({
    days: 45,
    seed: 4545,
    skip: (index) => index % 7 === 6 || (index >= 23 && index <= 26),
  });
  session.at(NOW - 10 * MINUTE, (ctx) =>
    createChallenge(ctx, { templateId: 'rings_5', message: 'Loser cooks dinner' }),
  );
  const state = openApp(session);
  if (state.tree.rings < 30) fail('day45 should have at least 30 rings');
  return state;
}

// ── day200: a mature tree and most of the island ─────────────────────────────
function day200(): GameState {
  const session = history({
    days: 200,
    seed: 200200,
    skip: (index) => index % 7 === 6 || (index >= 80 && index <= 84) || index === 131,
    lessonsEvery: 7,
  });
  session.at(NOW - 12 * MINUTE, (ctx) => updateSettings(ctx, { restDays: [0] }));
  const state = openApp(session);
  if (growthInfo(state.tree.gp).stage !== 'Mature tree')
    fail(`day200 should be a Mature tree, got ${growthInfo(state.tree.gp).stage}`);
  return state;
}

// ── thirsty: three missed days, waiting to be watered ────────────────────────
function thirsty(): GameState {
  const days = 18;
  const start = addDays(anchor, -(days + 3));
  const session = plant(start, 3003);
  const rng = createRng('fixture', 3003);
  for (let index = 0; index < days; index += 1)
    playDay(session, addDays(start, index), variedDay(rng, index));
  // Opening the app settles the three days nobody showed up on; nothing is watered yet.
  session.tick(NOW);
  const state = session.state;
  if (state.tree.vitality !== 'thirsty' || state.tree.missed !== 3)
    fail(`thirsty fixture is ${state.tree.vitality} (${state.tree.missed} missed)`);
  if (checkInvariants(state).length > 0) fail('thirsty: invariants broken');
  return state;
}

// ── dormant: more than a week away; the tree rests and kept every ring ───────
function dormant(): GameState {
  const days = 30;
  const away = 11;
  const start = addDays(anchor, -(days + away));
  const session = plant(start, 7007, 'Maya', 'cherry');
  const rng = createRng('fixture', 7007);
  for (let index = 0; index < days; index += 1)
    playDay(session, addDays(start, index), variedDay(rng, index));
  session.tick(NOW);
  const state = session.state;
  if (state.tree.vitality !== 'dormant') fail(`dormant fixture is ${state.tree.vitality}`);
  if (checkInvariants(state).length > 0) fail('dormant: invariants broken');
  return state;
}

// ── power-user: 320 maximum days: an elder tree, every prop, nearly every badge ─
function powerUser(): GameState {
  const days = 320;
  const start = addDays(anchor, -(days - 1));
  const session = plant(start, 9001, 'Arjun', 'pine');
  session.at(localTime(start, 8, 5), (ctx) =>
    setBaseline(ctx, { ...BASELINE, diet: 'low-meat', transportMode: 'bus' }, { useAsFocus: true }),
  );
  for (let index = 0; index < days; index += 1) {
    const day = addDays(start, index);
    const logs: LogSpec[] = [
      ['plant-based-meal', 3],
      ['walk-cycle-instead-of-car', 5],
      // One more act, rotating through Power, Waste and Water so every prop is earned.
      index % 3 === 0
        ? ['standby-off', 1]
        : index % 3 === 1
          ? ['refuse-single-use-bottle', 1]
          : ['shorter-shower', 2],
    ];
    if (index % 5 === 0)
      logs.push([
        index % 10 === 0 ? 'tend-plants' : 'compost-food-waste',
        index % 10 === 0 ? 1 : 0.5,
      ]);
    if (index % 30 === 12) logs.push(['repair-instead-of-replace', 1, { variant: 'garment' }]);
    if (index % 45 === 20) logs.push(['car-free-day', 1]);
    if (index === 150) logs.push(['train-instead-of-short-flight-trip', 1]);
    const isToday = index === days - 1;
    const script: DayScript = {
      logs: isToday ? logs.slice(0, 3) : logs,
      claim: !isToday,
      breakMin: isToday ? undefined : 20,
      lesson:
        !isToday && index % 6 === 2 && index / 6 < LESSON_SLUGS.length
          ? [LESSON_SLUGS[(index / 6) | 0] as string, 3]
          : undefined,
      myths: !isToday && index % 9 === 4 && index / 9 < 10 ? [((index / 9) | 0) + 1] : undefined,
      note:
        !isToday && index % 25 === 7
          ? ['Still going. The tree looks different every month.', 'win']
          : undefined,
      custom: index === 40 ? ['Organised a swap shelf in the stairwell', 'stuff', 4] : undefined,
    };
    playDay(session, day, script, isToday ? NOW - 15 * MINUTE : undefined);
  }
  const state = openApp(session);
  if (growthInfo(state.tree.gp).stage !== 'Elder')
    fail(`power-user should be an Elder, got ${growthInfo(state.tree.gp).stage}`);
  return state;
}

const fixtures: Record<string, () => GameState | null> = {
  fresh: () => null,
  day1,
  day12,
  day45,
  day200,
  thirsty,
  dormant,
  'power-user': powerUser,
};

mkdirSync(outDir, { recursive: true });
for (const [name, build] of Object.entries(fixtures)) {
  const state = build();
  const entries: Record<string, unknown> = {};
  let summary = 'not onboarded: no saved state';
  if (state) {
    // What is written must load again through the app's own validation.
    const stored = serializeStoredGame(state);
    const loaded = parseStoredGame(stored);
    if (!loaded.ok) fail(`${name} does not load: ${loaded.detail}`);
    entries[STORAGE_KEYS.game] = JSON.parse(stored);
    const growth = growthInfo(state.tree.gp);
    const world = selectWorldSnapshot(state, NOW);
    const kg = state.logs.reduce(
      (sum, log) => sum + (log.estimate === 'factor' ? (log.co2eKg ?? 0) : 0),
      0,
    );
    summary = `L${levelOf(state.xp)} · ${state.xp} XP · ${growth.stage} (${world.growth.toFixed(3)}) · ${state.tree.vitality} · rings ${state.tree.rings} · streak ${state.streak.current} · ≈ ${kg.toFixed(1)} kg · ${state.logs.length} logs · ${world.props.length} props`;
  } else if (createInitialState(NOW).onboarding.completedAt !== null) {
    fail('a fresh state must not be onboarded');
  }
  const file = path.join(outDir, `${name}.json`);
  const config = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(
    file,
    await prettier.format(JSON.stringify(entries), { ...config, parser: 'json' }),
  );
  console.log(`${name.padEnd(11)} ${summary}`);
}
console.log(`\nfixtures anchored to ${anchor} written to scripts/fixtures/`);
