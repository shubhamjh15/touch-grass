/**
 * Composes the built-in coach's answers. Deterministic: the same message and
 * context always produce the same text, so tests can pin it and the answer
 * never changes when the user asks twice. Personalised from `CoachContext`,
 * with "log this" chips only for actions the context actually offers.
 */
import { formatCo2Estimate, pluralize } from '@/lib/format';
import { hashString } from '@/lib/rng';
import {
  EVIDENCE_CATEGORY_TO_PRODUCT,
  type CoachAction,
  type CoachContext,
  type CoachQuest,
} from '../contract';
import { matchIntent, normalise, type IntentId } from './intents';
import {
  CRISIS_REPLY,
  DAILY_FACTS,
  DINNER_IDEAS,
  FOOD_LADDER,
  JOKES,
  OFFLINE_LABEL,
} from './knowledge';

export interface OfflineReply {
  text: string;
  intent: IntentId;
  /** Always "Built-in coach": the UI shows it so nobody mistakes this for the live model. */
  label: typeof OFFLINE_LABEL;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,47}$/;

/** Text that came from the user or the game must never be able to write chip syntax or markup. */
function plain(value: string | undefined, max = 80): string | undefined {
  if (value === undefined) return undefined;
  const text = [...value]
    .filter((char) => char.charCodeAt(0) > 31)
    .join('')
    .replace(/\[\[|\]\]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...text].slice(0, max).join('');
}

function scrub(context: CoachContext): CoachContext {
  return {
    ...context,
    displayName: plain(context.displayName, 40),
    tree: context.tree
      ? {
          ...context.tree,
          name: plain(context.tree.name, 40),
          vitality: plain(context.tree.vitality, 20),
        }
      : undefined,
    baseline: plain(context.baseline, 120),
    topCategories: context.topCategories?.map((item) => ({
      ...item,
      category: plain(item.category, 24) ?? '',
    })),
    actions: context.actions?.map((action) => ({
      ...action,
      title: plain(action.title, 80) ?? '',
    })),
    quests: context.quests?.map((quest) => ({ ...quest, line: plain(quest.line, 100) ?? '' })),
    nextLesson: context.nextLesson
      ? { ...context.nextLesson, title: plain(context.nextLesson.title, 60) ?? '' }
      : undefined,
  };
}

function pick<T>(variants: readonly T[], seed: number): T {
  return variants[seed % variants.length] as T;
}

function canonicalCategory(category: string): string {
  const key = category.trim().toLowerCase();
  return EVIDENCE_CATEGORY_TO_PRODUCT[key] ?? key;
}

function inCategories(action: CoachAction, categories: readonly string[]): boolean {
  if (!action.category) return false;
  const own = canonicalCategory(action.category);
  return categories.some((category) => canonicalCategory(category) === own);
}

function treeName(context: CoachContext): string {
  return context.tree?.name?.trim() || 'Your tree';
}

/** The tree's name for use in the middle of a sentence. */
function treeRef(context: CoachContext): string {
  return context.tree?.name?.trim() || 'your tree';
}

function vitality(context: CoachContext): string | undefined {
  return context.tree?.vitality?.trim().toLowerCase() || undefined;
}

function openActions(context: CoachContext): CoachAction[] {
  return (context.actions ?? []).filter((action) => ID_PATTERN.test(action.id));
}

/** The first preferred action the context offers and the user has not maxed today. */
function findAction(
  context: CoachContext,
  preferredIds: readonly string[],
  categories: readonly string[] = [],
): CoachAction | null {
  const actions = openActions(context).filter((action) => !action.doneToday);
  for (const id of preferredIds) {
    const hit = actions.find((action) => action.id === id);
    if (hit) return hit;
  }
  if (categories.length === 0) return null;
  return actions.find((action) => inCategories(action, categories)) ?? null;
}

const chip = (action: CoachAction | null): string => (action ? `[[log:${action.id}]]` : '');

function chips(...actions: (CoachAction | null)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const action of actions) {
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(chip(action));
  }
  return out.join('\n');
}

function lessonChip(context: CoachContext, candidates: readonly string[]): string {
  const slug = candidates.find((candidate) => context.lessonSlugs?.includes(candidate));
  return slug ? `[[learn:${slug}]]` : '';
}

function withChips(body: string, tokens: string): string {
  return tokens ? `${body}\n${tokens}` : body;
}

function focusMatch(context: CoachContext): (action: CoachAction) => boolean {
  const focus = context.focus ?? [];
  return (action) => focus.length > 0 && inCategories(action, focus);
}

function easiestAction(context: CoachContext): { action: CoachAction; inFocus: boolean } | null {
  const open = openActions(context).filter((action) => !action.doneToday);
  const inFocus = focusMatch(context);
  const preferred = open.find(inFocus);
  if (preferred) return { action: preferred, inFocus: true };
  const first = open[0];
  return first ? { action: first, inFocus: false } : null;
}

function closestQuest(context: CoachContext): CoachQuest | null {
  const open = (context.quests ?? []).filter(
    (quest) => ID_PATTERN.test(quest.id) && (quest.progress ?? 0) < 1,
  );
  if (open.length === 0) return null;
  return open.reduce((best, quest) =>
    (quest.progress ?? 0) > (best.progress ?? 0) ? quest : best,
  );
}

function thirstyPrefix(context: CoachContext): string {
  const state = vitality(context);
  if (state === 'thirsty')
    return `${treeName(context)} is a little thirsty, and any log counts as water. `;
  if (state === 'dormant') return `${treeName(context)} is resting, and one log wakes it up. `;
  return '';
}

// ---------------------------------------------------------------------------
// Intent replies
// ---------------------------------------------------------------------------

type Reply = (context: CoachContext, seed: number) => string;

const easyWin: Reply = (context, seed) => {
  const found = easiestAction(context);
  const lead = thirstyPrefix(context);
  if (!found) {
    return `${lead}One easy win: the next time you're about to make a short trip, walk or ride instead. Anything under about 3 km usually works, and it takes a minute to log.`;
  }
  const { action, inFocus } = found;
  const reason = inFocus
    ? "It's in one of your focus areas and you haven't logged it today."
    : "You haven't logged it today.";
  const body = pick(
    [
      `${lead}Easiest win from here: ${action.title}. ${reason}`,
      `${lead}Try this one: ${action.title}. ${reason} It takes seconds to log, and ${treeRef(context)} grows with every log.`,
    ],
    seed,
  );
  return withChips(body, chip(action));
};

const biggestLever: Reply = (context) => {
  const top = context.topCategories?.[0]?.category;
  const lessons = lessonChip(context, ['big-levers', 'where-it-comes-from']);
  if (context.baseline) {
    return withChips(
      `Your starting line: ${context.baseline}. For most households the biggest levers are how we travel, what we eat and how we heat the home, and your own mix decides which comes first. Small actions build the habit; the big levers move the number. A rough guess, not a verdict.`,
      lessons,
    );
  }
  const habit = top ? ` So far you log the most in ${top}, which is a real strength.` : '';
  return withChips(
    `Usually it's travel (especially driving and flying), heating and food (especially beef and lamb). Which one is yours depends on your life.${habit} Take the 60-second starting-line quiz and I can be specific.`,
    lessons,
  );
};

const explainNumbers: Reply = (context) => {
  const totals = context.totals;
  const sofar =
    totals?.kgTotal !== undefined && totals.kgTotal > 0
      ? ` So far that adds up to ≈ ${formatCo2Estimate(totals.kgTotal)} avoided${totals.actionsTotal ? ` across ${pluralize(totals.actionsTotal, 'action')}` : ''}.`
      : '';
  return `Every figure is an estimate: your action compared with the typical alternative, using published emission factors. That's why you see ≈. Treat totals as the right size, not the right decimal.${sofar} The methodology page lists every source.`;
};

const whatIsCo2e: Reply = (context) =>
  withChips(
    'CO2e (carbon dioxide equivalent) bundles all greenhouse gases into the amount of CO2 that would cause the same warming over a set period, usually 100 years. That lets methane and nitrous oxide be added up with CO2 in one number.',
    lessonChip(context, ['where-it-comes-from', 'the-blanket']),
  );

const streak: Reply = (context) => {
  const days = context.streak ?? 0;
  const rain = context.rain ?? 0;
  if (days <= 0) {
    return `No streak is running yet, and that's fine: the next log starts one. Missing a day never hurts ${treeRef(context)}; it only gets thirsty and waits for you.`;
  }
  const cover =
    rain > 0
      ? ` You have ${pluralize(rain, 'rain cloud')} banked, which covers a missed day so the streak holds.`
      : ' A rain cloud, once you earn one, covers a missed day so the streak holds.';
  return `Your streak is ${pluralize(days, 'day')}. Any day with a log keeps it going.${cover} And a missed day never hurts the tree: it only gets thirsty and waits.`;
};

const treeStatus: Reply = (context) => {
  const tree = treeName(context);
  const state = vitality(context);
  const base = `${tree} gets thirsty after a missed day and rests if you're away for longer. One log wakes it up, and nothing it has grown is ever lost.`;
  if (state === 'thriving') return `${tree} is thriving right now. ${base}`;
  if (state === 'thirsty') return `${tree} is thirsty right now. ${base}`;
  if (state === 'dormant') return `${tree} is resting right now. ${base}`;
  return base;
};

const food: Reply = (context, seed) => {
  const start = seed % DINNER_IDEAS.length;
  const ideas = [0, 1, 2]
    .map((offset) => DINNER_IDEAS[(start + offset) % DINNER_IDEAS.length])
    .join(', ');
  const tokens = chips(
    findAction(context, ['eat_plant_meal', 'eat_veg_meal'], ['eat']),
    findAction(context, ['eat_beef_swap']),
  );
  return withChips(
    `Three easy plant-forward dinners: ${ideas}. ${FOOD_LADDER} So swapping beef or lamb is the biggest single change on a plate.`,
    tokens,
  );
};

const foodWaste: Reply = (context) =>
  withChips(
    "Food you throw away carries the emissions of growing, shipping and cooking it, plus your money. Plan two or three meals, freeze what you won't eat in time, and cook the oldest ingredients first.",
    chips(findAction(context, ['eat_use_it_up'])),
  );

const transport: Reply = (context) =>
  withChips(
    'Short trips are the easy ones: anything under about 3 km is usually a walk or a ride. Per kilometre, a train typically emits several times less than driving alone, and a bus or tram sits in between.',
    chips(
      findAction(context, ['move_bike_trip', 'move_walk_trip'], ['move']),
      findAction(context, ['move_transit_trip', 'move_train_trip']),
    ),
  );

const flying: Reply = (context) =>
  withChips(
    "Flying is the one big-ticket item: a single long-haul return flight can add up to weeks or months of everyday footprint. Where a train or coach works, it's usually far lower. When it doesn't, fewer, longer trips beat many short ones. I'd rather you enjoy the trip than feel guilty about it.",
    chips(findAction(context, ['move_train_not_plane'])),
  );

const homeEnergy: Reply = (context) =>
  withChips(
    'Heating and hot water are usually the biggest part of home energy in cooler climates. One degree off the thermostat typically saves roughly 5 to 10% of heating energy, and washing at 30 °C instead of 60 °C uses far less energy because most of it heats the water. A full machine and a drying rack add up too.',
    chips(
      findAction(context, ['power_heat_down'], ['power']),
      findAction(context, ['water_cold_wash']),
    ),
  );

const stuffWaste: Reply = (context) =>
  withChips(
    'Order of play for stuff: use what you have, borrow, buy second-hand, repair, and recycle last. Recycling helps, but the energy and materials already inside an object are saved far more by keeping it in use.',
    [
      chips(findAction(context, ['stuff_repair', 'stuff_secondhand'], ['stuff'])),
      lessonChip(context, ['recycling-honestly']),
    ]
      .filter(Boolean)
      .join('\n'),
  );

const recyclingWorth: Reply = (context) =>
  withChips(
    'Yes, with caveats. Recycling metals saves most of the energy of making them new (aluminium especially), and paper and glass help too. Plastic is the weak spot: much of it is downcycled or never recycled. So: reduce and reuse first, then recycle clean, sorted items, and skip the wishful kind.',
    [
      chips(findAction(context, ['waste_recycle'], ['waste'])),
      lessonChip(context, ['recycling-honestly']),
    ]
      .filter(Boolean)
      .join('\n'),
  );

const moneySwap: Reply = (context) =>
  withChips(
    'Several of the best swaps pay you back. A degree off the thermostat, cooler and fuller washes, lunch and a bottle from home, repairing before replacing, and planning meals so less food gets binned. For short trips, walking is free.',
    chips(
      findAction(context, ['power_heat_down']),
      findAction(context, ['stuff_refill', 'eat_use_it_up']),
      findAction(context, ['stuff_repair']),
    ),
  );

const quests: Reply = (context) => {
  const all = context.quests ?? [];
  if (all.length === 0) {
    return "I can't see any quests right now. Open the Quests page for today's and this week's, and I'll help you pick the quickest one.";
  }
  const quest = closestQuest(context);
  if (!quest)
    return `Every open quest is done. Nicely done: new ones arrive as the days roll over.`;
  const percent = Math.round((quest.progress ?? 0) * 100);
  const progress =
    percent > 0
      ? ` You're about ${percent}% of the way there, so one good push finishes it.`
      : ' It is a fair place to start.';
  return withChips(`Closest to done is ${quest.line}.${progress}`, `[[quest:${quest.id}]]`);
};

const anxiety: Reply = () =>
  withChips(
    "That feeling makes sense: it means you're paying attention. Two true things: surveys across many countries find most people want stronger climate action, and projections for this century have come down over the past decade as clean energy got cheaper. You can't fix it alone and you don't have to. One small thing now? Ten minutes outside counts. If it feels heavy, talking to someone you trust helps too.",
    '[[break:10]]',
  );

const howItWorks: Reply = (context) =>
  `XP is your effort, the tree is your consistency, and ≈ kg is the impact estimate. Log what you really did, and ${treeRef(context)} grows with each log and each day you show up. Missing a day never kills it; it only gets thirsty.`;

const enableLive: Reply = () =>
  "The live coach switches on when whoever hosts this app adds an AI key on the server. Until then you've got me: the built-in coach, with fewer words and the same facts. I'm written answers, not an AI model, and I'll say so when I don't know.";

const whoAreYou: Reply = () =>
  "I'm the built-in coach inside Touch Grass: a set of hand-written answers, not an AI model. When a live AI is connected it takes over the chat; until then I cover easy wins, your numbers, food, travel, home energy, stuff, quests and how the app works.";

const greeting: Reply = (context, seed) => {
  const name = context.displayName?.trim();
  const hello = pick(['Hey', 'Hi', 'Hello'], seed);
  const state = vitality(context);
  const tree = state ? `${treeName(context)} is ${state === 'dormant' ? 'resting' : state}. ` : '';
  return `${name ? `${hello} ${name}.` : `${hello}.`} ${tree}Want one idea for today?`;
};

const thanks: Reply = (context, seed) =>
  pick(
    [
      `Any time. ${treeName(context)} says thanks too.`,
      'Glad to help. Small steps are how this works.',
    ],
    seed,
  );

const goodbye: Reply = (context) =>
  `See you soon. ${treeName(context)} will be here, growing quietly.`;

const howAreYou: Reply = () =>
  "I'm a built-in coach, so I'm always the same: ready when you are. How about one easy win for today?";

const joke: Reply = (_context, seed) => pick(JOKES, seed);

const offTopic: Reply = () =>
  "That's outside what I can help with. I stick to sustainability, your habits and how Touch Grass works, and I can't give medical, legal or financial advice. Want one easy win instead?";

const unknown: Reply = () =>
  "I'm the built-in coach, so I only know a few topics: easy wins, your numbers, food, travel, home energy, stuff and waste, quests, and how the app works. I'd rather say that than guess. Try one of the suggestions.";

const REPLIES: Readonly<Record<Exclude<IntentId, 'crisis'>, Reply>> = {
  greeting,
  thanks,
  goodbye,
  how_are_you: howAreYou,
  who_are_you: whoAreYou,
  joke,
  easy_win: easyWin,
  biggest_lever: biggestLever,
  explain_numbers: explainNumbers,
  what_is_co2e: whatIsCo2e,
  streak,
  tree_status: treeStatus,
  food,
  food_waste: foodWaste,
  transport,
  flying,
  home_energy: homeEnergy,
  stuff_waste: stuffWaste,
  recycling_worth: recyclingWorth,
  money_swap: moneySwap,
  quests,
  anxiety,
  how_it_works: howItWorks,
  enable_live: enableLive,
  off_topic: offTopic,
  unknown,
};

/** Answers one message from the user. Pure and synchronous. */
export function respondOffline(message: string, raw: CoachContext = {}): OfflineReply {
  const context = scrub(raw);
  const { intent } = matchIntent(message);
  if (intent === 'crisis') return { text: CRISIS_REPLY, intent, label: OFFLINE_LABEL };
  const seed = hashString(normalise(message));
  return { text: REPLIES[intent](context, seed), intent, label: OFFLINE_LABEL };
}

/**
 * The coach tip for the Today screen, by the spec's priority: a thirsty or
 * resting tree, a quest at least two-thirds done, the easiest unlogged action
 * in a focus area, then a fact. `seed` (for example the day number) rotates facts.
 */
export function offlineTip(raw: CoachContext = {}, seed = 0): OfflineReply {
  const context = scrub(raw);
  const state = vitality(context);
  const easy = easiestAction(context);
  if (state === 'thirsty' || state === 'dormant') {
    const line = state === 'thirsty' ? 'is thirsty' : 'is resting';
    const text = `${treeName(context)} ${line}. One log is all it takes to bring it back.`;
    return {
      text: withChips(text, chip(easy?.action ?? null)),
      intent: 'tree_status',
      label: OFFLINE_LABEL,
    };
  }
  const quest = closestQuest(context);
  if (quest && (quest.progress ?? 0) >= 0.66) {
    // The line already reads "Title: what to do (2 / 3)": a second colon in front stutters.
    const text = `Nearly there on ${quest.line}.`;
    return {
      text: withChips(text, `[[quest:${quest.id}]]`),
      intent: 'quests',
      label: OFFLINE_LABEL,
    };
  }
  if (easy && (context.ringLeft ?? 0) > 0) {
    const left = context.ringLeft ?? 0;
    const text = `${pluralize(left, 'more action')} ${left === 1 ? 'closes' : 'close'} today's ring. ${easy.action.title} is a quick one.`;
    return { text: withChips(text, chip(easy.action)), intent: 'easy_win', label: OFFLINE_LABEL };
  }
  if (easy?.inFocus) {
    const text = `Easy one in your focus area: ${easy.action.title}.`;
    return { text: withChips(text, chip(easy.action)), intent: 'easy_win', label: OFFLINE_LABEL };
  }
  if (context.nextLesson && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,47}$/.test(context.nextLesson.slug)) {
    const title = context.nextLesson.title.replace(/[<>[\]]/g, '').slice(0, 60);
    return {
      text: withChips(
        `A two-minute read worth your time: ${title}.`,
        `[[learn:${context.nextLesson.slug}]]`,
      ),
      intent: 'unknown',
      label: OFFLINE_LABEL,
    };
  }
  return { text: pick(DAILY_FACTS, Math.abs(seed)), intent: 'unknown', label: OFFLINE_LABEL };
}
