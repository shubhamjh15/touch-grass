/**
 * The quest pool: 32 daily and 24 weekly quests plus 12 long-term epics. Data only.
 * Conditions are a small vocabulary the engine evaluates against the user's logs
 * (`src/game/quests.ts`); rotation and claiming live there too.
 */
import type { CatalogueActionId, CategoryId } from './catalogue';

/** A set of catalogue actions, or `*` for any action. */
export type ActionSet = readonly CatalogueActionId[] | '*';

export type QuestCondition =
  /** Rewarded acts of the given actions. */
  | { kind: 'acts'; actions: ActionSet; min: number }
  /** Rewarded acts in one category. */
  | { kind: 'categoryActs'; category: CategoryId; min: number }
  /** Summed quantity of logs that have at least one rewarded act. */
  | { kind: 'units'; actions: ActionSet; min: number }
  /** Distinct categories with a rewarded act. */
  | { kind: 'categories'; min: number }
  /** The day ring is closed. */
  | { kind: 'ring' }
  | { kind: 'checkIn' }
  /** The check-in happened before this local hour. */
  | { kind: 'checkInBefore'; hour: number }
  /** Kept Touch Grass breaks of at least `minutes`. */
  | { kind: 'break'; minutes: number; min: number }
  /** Lessons opened or myth cards flipped; repeats count. */
  | { kind: 'learnOpen'; min: number; lessonsOnly: boolean }
  /** Journal notes of 20 or more characters. */
  | { kind: 'post'; min: number }
  /** All three dailies claimed that day. */
  | { kind: 'cleanSweep' }
  /** Rewarded acts logged from a coach suggestion. */
  | { kind: 'coach'; min: number }
  /** Distinct days in the period on which the inner condition holds. */
  | { kind: 'days'; of: QuestCondition; min: number }
  | { kind: 'all'; of: readonly QuestCondition[] }
  | { kind: 'any'; of: readonly QuestCondition[] };

export type DailyPool =
  'easy' | 'move' | 'eat' | 'power' | 'water' | 'stuff' | 'waste' | 'nature' | 'any';
export type WeeklyPool = Exclude<DailyPool, 'easy'> | 'consistency';

export interface QuestDef<Pool extends string = string> {
  id: string;
  title: string;
  /** Card copy: what to do, in one line. */
  copy: string;
  condition: QuestCondition;
  xp: number;
  pool: Pool;
}

export type EpicRequirement =
  /** Rewarded acts ever logged. */
  | { kind: 'lifetimeActs'; actions: ActionSet; min: number }
  /** Rewarded acts inside any window of `windowDays` consecutive days. */
  | { kind: 'windowActs'; actions: ActionSet; min: number; windowDays: number }
  | { kind: 'rings'; min: number }
  | { kind: 'lessonsPassed'; min: number };

/** What the user confirms by hand before a self-attested epic can be claimed. */
export type EpicAttestation =
  | { kind: 'confirm' }
  | { kind: 'checklist'; items: readonly string[] }
  | { kind: 'note'; prompt: string }
  | { kind: 'form'; fields: readonly string[] };

export interface EpicDef {
  id: string;
  title: string;
  /** What it takes, in one or two sentences. */
  copy: string;
  xp: number;
  /** Tracked automatically from logs; `null` for purely self-attested epics. */
  requirement: EpicRequirement | null;
  /** `null` = claimable as soon as the requirement is met. */
  attestation: EpicAttestation | null;
}

// ── Action sets (spec section 4.3) ──────────────────────────────────────────
export const ACTIVE = ['walk-cycle-instead-of-car', 'ebike-escooter-instead-of-car'] as const;
export const SHARED = ['bus-instead-of-car', 'train-metro-instead-of-car', 'carpool'] as const;
export const PLANT = [
  'plant-based-meal',
  'plant-based-instead-of-beef',
  'vegetarian-day',
  'vegan-day',
] as const;
export const RESCUE = ['food-waste-avoided', 'meal-saved-from-waste'] as const;
export const LAUNDRY = ['wash-30-instead-of-40', 'wash-cold-instead-of-40'] as const;
export const RECYCLE = [
  'recycle-aluminium-can',
  'recycle-glass-bottle',
  'recycle-plastic-bottle',
  'recycle-paper',
] as const;
export const REFUSE = [
  'refuse-single-use-bag',
  'refuse-single-use-cup',
  'refuse-single-use-bottle',
] as const;
export const SECONDHAND = ['second-hand-tshirt', 'second-hand-jeans'] as const;
export const GREEN = ['plant-a-tree', 'tend-plants', 'help-wildlife'] as const;

const acts = (actions: ActionSet, min = 1): QuestCondition => ({ kind: 'acts', actions, min });
const units = (actions: ActionSet, min: number): QuestCondition => ({
  kind: 'units',
  actions,
  min,
});
const days = (of: QuestCondition, min: number): QuestCondition => ({ kind: 'days', of, min });
const tenMinuteBreak: QuestCondition = { kind: 'break', minutes: 10, min: 1 };

// ── Daily pool (32) ─────────────────────────────────────────────────────────
export const DAILY_QUESTS: readonly QuestDef<DailyPool>[] = [
  {
    id: 'd_first_light',
    title: 'First light',
    copy: 'Water your tree and log one action',
    condition: { kind: 'all', of: [{ kind: 'checkIn' }, acts('*')] },
    xp: 15,
    pool: 'easy',
  },
  {
    id: 'd_double_up',
    title: 'Double up',
    copy: 'Log two actions',
    condition: acts('*', 2),
    xp: 15,
    pool: 'easy',
  },
  {
    id: 'd_full_ring',
    title: 'Full ring',
    copy: "Close today's ring",
    condition: { kind: 'ring' },
    xp: 20,
    pool: 'easy',
  },
  {
    id: 'd_early_bird',
    title: 'Early bird',
    copy: 'Check in before 10:00',
    condition: { kind: 'checkInBefore', hour: 10 },
    xp: 15,
    pool: 'easy',
  },
  {
    id: 'd_mix_it_up',
    title: 'Mix it up',
    copy: 'Log in two different categories',
    condition: { kind: 'categories', min: 2 },
    xp: 15,
    pool: 'easy',
  },
  {
    id: 'd_touch_grass',
    title: 'Touch grass',
    copy: 'Finish a 10-minute break',
    condition: tenMinuteBreak,
    xp: 20,
    pool: 'easy',
  },
  {
    id: 'd_muscle_power',
    title: 'Muscle-powered',
    copy: 'Walk or ride instead of driving',
    condition: acts(ACTIVE),
    xp: 20,
    pool: 'move',
  },
  {
    id: 'd_ride_together',
    title: 'Ride together',
    copy: 'Bus, train or a shared ride',
    condition: acts(SHARED),
    xp: 20,
    pool: 'move',
  },
  {
    id: 'd_keys_stay_home',
    title: 'Keys stay home',
    copy: 'A car-free or work-from-home day',
    condition: acts(['car-free-day', 'work-from-home-day']),
    xp: 20,
    pool: 'move',
  },
  {
    id: 'd_five_k',
    title: 'Five by muscle',
    copy: "Walk or cycle 5 km you'd have driven",
    condition: units(['walk-cycle-instead-of-car'], 5),
    xp: 25,
    pool: 'move',
  },
  {
    id: 'd_plant_plate',
    title: 'Plant plate',
    copy: 'One plant-based meal',
    condition: acts(PLANT),
    xp: 15,
    pool: 'eat',
  },
  {
    id: 'd_plant_day',
    title: 'Plant-powered day',
    copy: 'Three plant-based meals',
    condition: acts(PLANT, 3),
    xp: 25,
    pool: 'eat',
  },
  {
    id: 'd_clean_plate',
    title: 'Clean plate club',
    copy: 'Rescue food from the bin',
    condition: acts(RESCUE),
    xp: 20,
    pool: 'eat',
  },
  {
    id: 'd_skip_the_beef',
    title: 'Skip the beef',
    copy: 'Swap one beef meal',
    condition: acts(['plant-based-instead-of-beef', 'chicken-instead-of-beef']),
    xp: 20,
    pool: 'eat',
  },
  {
    id: 'd_vampire_slayer',
    title: 'Vampire slayer',
    copy: 'Kill the standby lights',
    condition: acts(['standby-off']),
    xp: 15,
    pool: 'power',
  },
  {
    id: 'd_one_degree',
    title: 'One degree',
    copy: 'Heating down or AC up by 1 °C',
    condition: acts(['thermostat-down-1c', 'ac-up-1c']),
    xp: 20,
    pool: 'power',
  },
  {
    id: 'd_sun_dried',
    title: 'Sun-dried',
    copy: 'Air-dry a load',
    condition: acts(['line-dry-instead-of-tumble']),
    xp: 20,
    pool: 'power',
  },
  {
    id: 'd_quick_rinse',
    title: 'Quick rinse',
    copy: 'Take a shorter shower',
    condition: acts(['shorter-shower']),
    xp: 20,
    pool: 'water',
  },
  {
    id: 'd_cool_cycle',
    title: 'Cool cycle',
    copy: 'A load at 30 °C or cold',
    condition: acts(LAUNDRY),
    xp: 20,
    pool: 'water',
  },
  {
    id: 'd_tap_tamer',
    title: 'Tap tamer',
    copy: 'Save hot water or keep the tap off',
    condition: acts(['hot-water-saved', 'tap-off-while-brushing']),
    xp: 15,
    pool: 'water',
  },
  {
    id: 'd_pre_loved',
    title: 'Pre-loved',
    copy: 'Second-hand, repaired, borrowed or passed on',
    condition: acts([
      ...SECONDHAND,
      'repair-instead-of-replace',
      'borrow-instead-of-buy',
      'pass-it-on',
    ]),
    xp: 25,
    pool: 'stuff',
  },
  {
    id: 'd_pass_it_on',
    title: 'Pass it on',
    copy: 'Sell, donate or swap something',
    condition: acts(['pass-it-on']),
    xp: 20,
    pool: 'stuff',
  },
  {
    id: 'd_make_it_last',
    title: 'Make it last',
    copy: 'Repair or borrow instead of buying',
    condition: acts(['repair-instead-of-replace', 'borrow-instead-of-buy']),
    xp: 25,
    pool: 'stuff',
  },
  {
    id: 'd_sorted',
    title: 'Sorted',
    copy: 'Recycle properly',
    condition: acts(RECYCLE),
    xp: 15,
    pool: 'waste',
  },
  {
    id: 'd_no_thanks',
    title: 'No thanks',
    copy: 'Dodge two single-use items',
    condition: acts(REFUSE, 2),
    xp: 15,
    pool: 'waste',
  },
  {
    id: 'd_scrap_heap',
    title: 'Scrap heap',
    copy: 'Compost your food scraps',
    condition: acts(['compost-food-waste']),
    xp: 20,
    pool: 'waste',
  },
  {
    id: 'd_say_it',
    title: 'Say it out loud',
    copy: 'Have one real climate conversation',
    condition: acts(['climate-conversation']),
    xp: 20,
    pool: 'nature',
  },
  {
    id: 'd_green_fingers',
    title: 'Green fingers',
    copy: 'Plant, tend or help wildlife',
    condition: acts(GREEN),
    xp: 20,
    pool: 'nature',
  },
  {
    id: 'd_leave_it_better',
    title: 'Leave it better',
    copy: 'Pick up litter',
    condition: acts(['litter-pick']),
    xp: 20,
    pool: 'nature',
  },
  {
    id: 'd_brain_food',
    title: 'Brain food',
    copy: 'Read a lesson or flip a myth card',
    condition: { kind: 'learnOpen', min: 1, lessonsOnly: false },
    xp: 15,
    pool: 'any',
  },
  {
    id: 'd_coach_pick',
    title: "Coach's pick",
    copy: 'Log something Moss suggested',
    condition: { kind: 'coach', min: 1 },
    xp: 20,
    pool: 'any',
  },
  {
    id: 'd_dear_diary',
    title: 'Dear diary',
    copy: 'Write a journal note',
    condition: { kind: 'post', min: 1 },
    xp: 15,
    pool: 'any',
  },
];

// ── Weekly pool (24) ────────────────────────────────────────────────────────
export const WEEKLY_QUESTS: readonly QuestDef<WeeklyPool>[] = [
  {
    id: 'w_five_alive',
    title: 'Five alive',
    copy: 'Show up on five days',
    condition: days({ kind: 'checkIn' }, 5),
    xp: 60,
    pool: 'consistency',
  },
  {
    id: 'w_four_rings',
    title: 'Four full rings',
    copy: 'Close your ring on four days',
    condition: days({ kind: 'ring' }, 4),
    xp: 80,
    pool: 'consistency',
  },
  {
    id: 'w_sampler',
    title: 'Sampler',
    copy: 'Log in four different categories',
    condition: { kind: 'categories', min: 4 },
    xp: 60,
    pool: 'consistency',
  },
  {
    id: 'w_fifteen',
    title: 'Fifteen for the week',
    copy: 'Log fifteen actions',
    condition: acts('*', 15),
    xp: 80,
    pool: 'consistency',
  },
  {
    id: 'w_double_sweep',
    title: 'Double sweep',
    copy: 'Claim all three dailies on two days',
    condition: days({ kind: 'cleanSweep' }, 2),
    xp: 100,
    pool: 'consistency',
  },
  {
    id: 'w_commuter',
    title: 'Low-carbon commuter',
    copy: 'Low-carbon trips on three days',
    condition: days(acts([...ACTIVE, ...SHARED]), 3),
    xp: 80,
    pool: 'move',
  },
  {
    id: 'w_twenty_by_muscle',
    title: 'Twenty by muscle',
    copy: 'Walk or cycle 20 km',
    condition: units(['walk-cycle-instead-of-car'], 20),
    xp: 100,
    pool: 'move',
  },
  {
    id: 'w_car_light',
    title: 'Car-light week',
    copy: 'Three car-free days',
    condition: days(acts(['car-free-day']), 3),
    xp: 80,
    pool: 'move',
  },
  {
    id: 'w_ten_plates',
    title: 'Ten plant plates',
    copy: 'Ten plant-based meals',
    condition: acts(PLANT, 10),
    xp: 80,
    pool: 'eat',
  },
  {
    id: 'w_fridge_rescue',
    title: 'Fridge rescue',
    copy: 'Rescue food three times',
    condition: acts(RESCUE, 3),
    xp: 60,
    pool: 'eat',
  },
  {
    id: 'w_two_plant_days',
    title: 'Two plant-powered days',
    copy: 'Three plant meals, twice',
    condition: days(acts(PLANT, 3), 2),
    xp: 100,
    pool: 'eat',
  },
  {
    id: 'w_dial_it_down',
    title: 'Dial it down',
    copy: 'Heating down or AC up on four days',
    condition: days(acts(['thermostat-down-1c', 'ac-up-1c']), 4),
    xp: 80,
    pool: 'power',
  },
  {
    id: 'w_hang_it_out',
    title: 'Hang it out',
    copy: 'Air-dry three loads',
    condition: acts(['line-dry-instead-of-tumble'], 3),
    xp: 60,
    pool: 'power',
  },
  {
    id: 'w_quick_rinse_week',
    title: 'Quick-rinse week',
    copy: 'Five shorter showers',
    condition: acts(['shorter-shower'], 5),
    xp: 80,
    pool: 'water',
  },
  {
    id: 'w_cool_cycle_week',
    title: 'Cool-cycle week',
    copy: 'Three loads at 30 °C or cold',
    condition: acts(LAUNDRY, 3),
    xp: 60,
    pool: 'water',
  },
  {
    id: 'w_the_fixer',
    title: 'The fixer',
    copy: 'Repair one thing instead of replacing it',
    condition: acts(['repair-instead-of-replace']),
    xp: 80,
    pool: 'stuff',
  },
  {
    id: 'w_round_and_round',
    title: 'Round and round',
    copy: 'Two things borrowed, passed on or pre-loved',
    condition: acts([...SECONDHAND, 'borrow-instead-of-buy', 'pass-it-on'], 2),
    xp: 60,
    pool: 'stuff',
  },
  {
    id: 'w_compost_starter',
    title: 'Compost starter',
    copy: 'Compost on three days',
    condition: days(acts(['compost-food-waste']), 3),
    xp: 60,
    pool: 'waste',
  },
  {
    id: 'w_single_use_slump',
    title: 'Single-use slump',
    copy: 'Dodge seven single-use items',
    condition: acts(REFUSE, 7),
    xp: 60,
    pool: 'waste',
  },
  {
    id: 'w_sort_it_out',
    title: 'Sort it out',
    copy: 'Recycle properly on three days',
    condition: days(acts(RECYCLE), 3),
    xp: 60,
    pool: 'waste',
  },
  {
    id: 'w_three_breaths',
    title: 'Three breaths of air',
    copy: 'Touch Grass on three days',
    condition: days(tenMinuteBreak, 3),
    xp: 80,
    pool: 'nature',
  },
  {
    id: 'w_use_your_voice',
    title: 'Use your voice',
    copy: 'One civic action, or two climate conversations',
    condition: { kind: 'any', of: [acts(['civic-action']), acts(['climate-conversation'], 2)] },
    xp: 100,
    pool: 'nature',
  },
  {
    id: 'w_green_thumb',
    title: 'Green thumb',
    copy: 'Plant, tend, help wildlife or pick litter on two days',
    condition: days(acts([...GREEN, 'litter-pick']), 2),
    xp: 60,
    pool: 'nature',
  },
  {
    id: 'w_study_buddy',
    title: 'Study buddy',
    copy: 'Read two lessons (re-reads count)',
    condition: { kind: 'learnOpen', min: 2, lessonsOnly: true },
    xp: 60,
    pool: 'any',
  },
];

// ── Epics (12) ──────────────────────────────────────────────────────────────
export const EPICS: readonly EpicDef[] = [
  {
    id: 'e_energy_checkup',
    title: 'Home energy check-up',
    copy: 'Five small jobs that make a home leak less energy.',
    xp: 300,
    requirement: null,
    attestation: {
      kind: 'checklist',
      items: [
        'LEDs in your most-used lights',
        'Find three standby vampires',
        'Check the thermostat schedule',
        'Draught-proof one door or window',
        'Fridge at about 4 °C, freezer at −18 °C',
      ],
    },
  },
  {
    id: 'e_green_power',
    title: 'Switch to green power',
    copy: 'Move to a renewable tariff, community solar or rooftop solar — or confirm you already have one.',
    xp: 300,
    requirement: null,
    attestation: { kind: 'confirm' },
  },
  {
    id: 'e_plant_a_real_one',
    title: 'Plant a real one',
    copy: 'Plant a native tree or shrub, or join a planting day.',
    xp: 250,
    requirement: { kind: 'lifetimeActs', actions: ['plant-a-tree'], min: 1 },
    attestation: { kind: 'confirm' },
  },
  {
    id: 'e_community_cleanup',
    title: 'Community clean-up',
    copy: 'Join or organise a clean-up of an hour or more.',
    xp: 250,
    requirement: {
      kind: 'lifetimeActs',
      actions: ['litter-pick', 'habitat-volunteering'],
      min: 1,
    },
    attestation: { kind: 'confirm' },
  },
  {
    id: 'e_advocate',
    title: 'Advocate',
    copy: 'Write to or call a representative, or speak at a public meeting, about one specific policy.',
    xp: 300,
    requirement: { kind: 'lifetimeActs', actions: ['civic-action'], min: 1 },
    attestation: { kind: 'note', prompt: 'Which policy, in one line?' },
  },
  {
    id: 'e_bin_audit',
    title: 'Bin audit',
    copy: 'Look through a week of your rubbish: name the top three items and one swap for each.',
    xp: 200,
    requirement: null,
    attestation: {
      kind: 'form',
      fields: ['Top item and its swap', 'Second item and its swap', 'Third item and its swap'],
    },
  },
  {
    id: 'e_thirty_rings',
    title: 'Thirty rings',
    copy: 'Show up on 30 days.',
    xp: 200,
    requirement: { kind: 'rings', min: 30 },
    attestation: null,
  },
  {
    id: 'e_car_light_month',
    title: 'Car-light month',
    copy: '12 car-free days inside any 30-day window.',
    xp: 350,
    requirement: { kind: 'windowActs', actions: ['car-free-day'], min: 12, windowDays: 30 },
    attestation: null,
  },
  {
    id: 'e_plant_forward_month',
    title: 'Plant-forward month',
    copy: '40 plant-based meals inside any 30-day window.',
    xp: 300,
    requirement: { kind: 'windowActs', actions: PLANT, min: 40, windowDays: 30 },
    attestation: null,
  },
  {
    id: 'e_mend_and_make_do',
    title: 'Mend & make do',
    copy: 'Five repairs, lifetime.',
    xp: 250,
    requirement: { kind: 'lifetimeActs', actions: ['repair-instead-of-replace'], min: 5 },
    attestation: null,
  },
  {
    id: 'e_climate_literate',
    title: 'Climate literate',
    copy: 'Pass all ten lesson quizzes.',
    xp: 300,
    requirement: { kind: 'lessonsPassed', min: 10 },
    attestation: null,
  },
  {
    id: 'e_grounded',
    title: 'Grounded for good reason',
    copy: 'Make one trip by train instead of flying.',
    xp: 400,
    requirement: {
      kind: 'lifetimeActs',
      actions: ['train-instead-of-short-flight-km', 'train-instead-of-short-flight-trip'],
      min: 1,
    },
    attestation: null,
  },
];

export const DAILY_QUEST_BY_ID: ReadonlyMap<string, QuestDef<DailyPool>> = new Map(
  DAILY_QUESTS.map((quest) => [quest.id, quest]),
);
export const WEEKLY_QUEST_BY_ID: ReadonlyMap<string, QuestDef<WeeklyPool>> = new Map(
  WEEKLY_QUESTS.map((quest) => [quest.id, quest]),
);
export const EPIC_BY_ID: ReadonlyMap<string, EpicDef> = new Map(
  EPICS.map((epic) => [epic.id, epic]),
);
