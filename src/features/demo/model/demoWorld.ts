/**
 * The demo world: about two hundred days of an ordinary, imperfect habit, played through
 * the real rules so that every number in it is one the engine computed. Nothing is typed
 * in by hand: a seeded generator decides what happens each day, a game that lives in
 * memory plays it, and the result is the state the sandbox shows.
 *
 * The history always ends today (a day that is still in progress), so nothing in it can
 * look stale, and the same day always grows the same world.
 */
import {
  LESSON_SLUGS,
  checkInvariants,
  createEventBus,
  createGame,
  selectQuests,
  type GameState,
  type LogInputs,
} from '@/game';
import { addDays, dayKey, parseDayKey, type DayKey } from '@/lib/dates';
import { createRng, type Rng } from '@/lib/rng';

/** How long the demo's tree has been growing, today included. */
export const DEMO_DAYS = 200;
/** One seed, one world: the tree, the island and the history are the same for everyone. */
export const DEMO_SEED = 200200;
export const DEMO_TREE_NAME = 'Fern';

const MINUTE = 60_000;

type LogSpec = readonly [actionId: string, qty?: number, inputs?: LogInputs];

interface DayScript {
  logs: LogSpec[];
  /** Claim every finished quest on the board at the end of the day. */
  claim: boolean;
  lesson?: readonly [slug: string, score: number];
  myth?: number;
  breakMin?: number;
  note?: readonly [text: string, tag: string];
}

/** The starting-line answers of someone with an ordinary footprint and room to move. */
const STARTING_LINE = {
  diet: 'medium-meat',
  transportMode: 'car-alone',
  weeklyDistance: '75-150',
  flights: 'short-1-2',
  homeEnergy: 'gas-typical',
  shopping: 'regular',
};

/** Journal notes are the demo's only free text: first person, nobody else in them. */
const NOTES: readonly (readonly [string, string])[] = [
  ['Cycled the short way round. Faster than the bus, honestly.', 'win'],
  ['Batch-cooked chickpea curry. Four dinners sorted.', 'win'],
  ['Forgot my bottle today. Borrowed a glass instead.', 'idea'],
  ['Turned the thermostat down a degree and did not notice.', 'win'],
  ['Farmers market for the first time in months.', 'idea'],
  ['Mended the zip on my jacket instead of replacing it.', 'win'],
];

const TRIPS: readonly LogSpec[] = [
  ['bus-instead-of-car', 10],
  ['bus-instead-of-car', 5],
  ['walk-cycle-instead-of-car', 3],
  ['train-metro-instead-of-car', 10],
  ['walk-cycle-instead-of-car', 5],
];

const SMALL_THINGS: readonly LogSpec[] = [
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
];

const NOW_AND_THEN: readonly LogSpec[] = [
  ['borrow-instead-of-buy', 1],
  ['pass-it-on', 1],
  ['litter-pick', 1],
  ['climate-conversation', 1],
];

/**
 * What is already stuck on today: two small things, so one more log closes the ring. No
 * meal and no trip among them, which leaves the day open for whatever a visitor tries first
 * ("I cycled to work and skipped meat today" must not meet a day that already counted meals).
 */
const TODAY_SO_FAR: readonly LogSpec[] = [
  ['refuse-single-use-bottle', 1],
  ['standby-off', 1],
];

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Epoch milliseconds of a local wall-clock time on a day. */
function localTime(day: DayKey, hour: number, minute = 0): number {
  const date = parseDayKey(day);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/** What happens on one day: a meal, a trip, usually one small thing, now and then more. */
function scriptFor(rng: Rng, index: number, weekday: number): DayScript {
  const logs: LogSpec[] = [];
  if (weekday === 6 && rng() < 0.5) logs.push(['vegetarian-day', 1]);
  else logs.push(['plant-based-meal', rng() < 0.3 ? 2 : 1]);
  logs.push(pick(rng, TRIPS));
  if (rng() < 0.7) logs.push(pick(rng, SMALL_THINGS));
  if (rng() < 0.12) logs.push(pick(rng, NOW_AND_THEN));
  const script: DayScript = {
    logs,
    claim: rng() < 0.6,
    breakMin: weekday === 6 || rng() < 0.08 ? 20 : undefined,
  };
  if (index % 11 === 6) script.note = pick(rng, NOTES);
  if (index % 17 === 9) script.myth = Math.floor(index / 17) + 1;
  return script;
}

/** Days nobody showed up on: every Sunday, a week away in the third month, one slip later. */
function isAway(index: number, weekday: number): boolean {
  return weekday === 0 || (index >= 80 && index <= 84) || index === 131;
}

export interface DemoProgress {
  /** The day being played, from 1. */
  day: number;
  days: number;
}

/**
 * Plays the history up to `now`, one small step at a time. It yields between steps so a
 * caller can spread the work over many frames; the return value is the finished state.
 */
export function* playDemoWorld(now: number): Generator<DemoProgress, GameState, void> {
  const today = dayKey(now);
  const start = addDays(today, -(DEMO_DAYS - 1));
  const clock = { now: localTime(start, 8) };
  const { actions, store } = createGame({
    persist: false,
    now: () => clock.now,
    seed: () => DEMO_SEED,
    events: createEventBus(),
  });
  const read = (): GameState => store.getState().game;
  const at = <T>(time: number, run: () => T): T => {
    // The clock only moves forward, and never past the moment the demo is opened.
    clock.now = Math.min(Math.max(time, clock.now), now);
    return run();
  };

  const planted = actions.onboard({ treeName: DEMO_TREE_NAME, species: 'oak' });
  if (!planted.ok) throw new Error(`demo world: could not plant (${planted.reason})`);
  at(localTime(start, 8, 5), () => {
    actions.setBaseline(STARTING_LINE, { useAsFocus: true });
    actions.updateSettings({ restDays: [0] });
  });

  const claimFinished = (time: number) => {
    const board = selectQuests(read(), clock.now);
    for (const quest of [...board.daily, ...board.weekly]) {
      if (quest.claimable) at(time, () => actions.claimQuest(quest.id));
    }
    for (const status of board.epics) {
      if (status.claimable && !status.selfAttested)
        at(time, () => actions.completeEpic(status.epic.id));
    }
  };

  const rng = createRng('demo-world', DEMO_SEED);
  let lessons = 0;
  for (let index = 0; index < DEMO_DAYS; index += 1) {
    const day = addDays(start, index);
    const weekday = parseDayKey(day).getDay();
    // Drawn for every day, shown up for or not, so one change never reshuffles the rest.
    const script = scriptFor(rng, index, weekday);
    const isToday = index === DEMO_DAYS - 1;
    if (!isToday && isAway(index, weekday)) continue;
    yield { day: index + 1, days: DEMO_DAYS };

    if (isToday) {
      // Every earlier message was read on its own day. Without this, the unread summaries
      // of 200 days add up into one ("77 finished quests claimed for you") that today's
      // opening never raised. The clock stays where it is, so no new day begins first.
      for (const notice of read().notices) at(0, () => actions.dismissNotice(notice.id));
      // Today is still open: watered and two things logged.
      const dayStart = localTime(day, 0, 0);
      const part = (share: number) => dayStart + Math.floor((now - dayStart) * share);
      at(part(0.4), () => actions.checkIn());
      TODAY_SO_FAR.forEach(([actionId, qty, inputs], step) => {
        at(part(0.5 + step * 0.2), () => actions.logAction({ actionId, qty, inputs }));
      });
      break;
    }

    if (index > 0) at(localTime(day, 8, 10), () => actions.checkIn());
    for (const [step, [actionId, qty, inputs]] of script.logs.entries()) {
      const result = at(localTime(day, 8, 20) + step * 7 * MINUTE, () =>
        actions.logAction({ actionId, qty, inputs, source: step === 0 ? 'quick' : 'log' }),
      );
      if (!result.ok) throw new Error(`demo world: ${day} ${actionId} refused (${result.reason})`);
      yield { day: index + 1, days: DEMO_DAYS };
    }
    if (script.breakMin) {
      const began = localTime(day, 12, 30);
      const minutes = script.breakMin;
      at(began, () => actions.startTouchGrass(minutes));
      at(began + 20_000, () => actions.signalTouchGrass('hidden'));
      at(began + minutes * MINUTE, () => actions.finishTouchGrass('outside'));
    }
    if (script.myth !== undefined) {
      const myth = script.myth;
      at(localTime(day, 18, 40), () => actions.flipMyth(myth));
    }
    const slug = LESSON_SLUGS[lessons];
    if (index % 7 === 3 && slug !== undefined) {
      const score = lessons % 3 === 0 ? 2 : 3;
      at(localTime(day, 19), () => actions.openLesson(slug));
      at(localTime(day, 19, 5), () => actions.completeLesson(slug, score));
      lessons += 1;
    }
    if (script.note) {
      const [text, tag] = script.note;
      at(localTime(day, 19, 30), () => actions.addPost({ text, tag, attachToday: true }));
    }
    if (script.claim) claimFinished(localTime(day, 21));
  }

  // The app has just been opened: its own first-run hints are done with, and yesterday's
  // messages were read. Only what today's opening raised stays unread.
  at(now, () => actions.markCoachMarksSeen());
  const todayKey = read().clock.today;
  for (const notice of read().notices) {
    if (notice.day < todayKey) at(now, () => actions.dismissNotice(notice.id));
  }

  const state = read();
  const problems = checkInvariants(state);
  if (problems.length > 0) throw new Error(`demo world: ${problems.join('; ')}`);
  return state;
}

/** The whole history in one go. A second or two of work: tests and tools only. */
export function buildDemoState(now: number): GameState {
  const play = playDemoWorld(now);
  for (;;) {
    const step = play.next();
    if (step.done) return step.value;
  }
}
