/**
 * Turns the chip tokens of a coach message into things the user can act on, checked against
 * the game as it is right now (product spec 8.5): the action exists, is not hidden, is not
 * maxed or blocked today and the quantity fits what is left of the day. A chip that fails
 * any check is dropped without a word, so Moss can never offer something that would be
 * refused. Nothing here logs: a log chip only ever leads to a confirmation.
 */
import { chipKey, parseCoachText, type ChipSegment, type CoachMessage } from '@/ai';
import { LESSON_BY_ID } from '@/data/content';
import type { ActionState, CategoryId } from '@/game';
import { ROUTES, TOUCH_GRASS_LINK, logLink } from '@/app/routes';
import { formatQuantity, type UnitSystem } from './quantity';

export interface LogChipView {
  kind: 'log';
  key: string;
  actionId: string;
  title: string;
  category: CategoryId;
  unit: string;
  /** The quantity the confirmation starts with: Moss's, or the user's usual one. */
  qty: number;
  /** Set only when Moss named a quantity: "5 km". */
  qtyLabel: string | null;
  /** Quantities offered in the confirmation, smallest first; all fit what is left today. */
  options: number[];
  /** The normal Log sheet, prefilled, for anything the confirmation does not cover. */
  href: string;
}

export interface LearnChipView {
  kind: 'learn';
  key: string;
  slug: string;
  title: string;
  minutes: number;
  href: string;
}

export interface QuestChipView {
  kind: 'quest';
  key: string;
  questId: string;
  title: string;
  progressText: string;
  claimable: boolean;
  href: string;
}

export interface BreakChipView {
  kind: 'break';
  key: string;
  minutes: number;
  href: string;
}

export type ChipView = LogChipView | LearnChipView | QuestChipView | BreakChipView;

export interface QuestRef {
  id: string;
  title: string;
  progressText: string;
  claimed: boolean;
  claimable: boolean;
}

/** The slice of the game a chip is checked against. */
export interface ChipWorld {
  actions: ReadonlyMap<string, ActionState>;
  quests: readonly QuestRef[];
  /** A break can start now (none is running and the cooldown is over). */
  breakAvailable: boolean;
  units: UnitSystem;
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * The quantities a confirmation offers: the action's presets that still fit today, plus
 * the starting quantity, so the chip's own number is always one of the choices.
 */
export function quantityOptions(state: ActionState, start: number): number[] {
  const fits = (qty: number) => qty > 0 && qty <= state.unitsLeft;
  const options = new Set(state.action.presets.filter(fits));
  if (fits(start)) options.add(start);
  return [...options].sort((a, b) => a - b).slice(0, 5);
}

function logChip(
  chip: Extract<ChipSegment, { kind: 'log' }>,
  world: ChipWorld,
  /** A chip the user already used in this session stays on the slip as "Stuck". */
  keep: boolean,
): LogChipView | null {
  const state = world.actions.get(chip.actionId);
  if (!state || state.hidden) return null;
  const { action } = state;
  if (!keep) {
    if (state.blocked !== null || state.maxed || state.unitsLeft <= 0) return null;
    if (chip.quantity !== null && chip.quantity > state.unitsLeft) return null;
  }
  // A quantity with more decimals than the action accepts would be refused on save.
  if (chip.quantity !== null && round(chip.quantity, action.decimals) !== chip.quantity) {
    return null;
  }
  const usual = Math.min(state.quickQty, Math.max(state.unitsLeft, 0)) || action.defaultQty;
  const qty = chip.quantity ?? round(usual, action.decimals);
  return {
    kind: 'log',
    key: chipKey(chip),
    actionId: action.id,
    title: action.title,
    category: action.category,
    unit: action.unit,
    qty,
    qtyLabel:
      chip.quantity === null ? null : formatQuantity(chip.quantity, action.unit, world.units),
    options: quantityOptions(state, qty),
    href: logLink(action.id, chip.quantity ?? undefined, 'coach'),
  };
}

/** One chip, or `null` when it should not be offered. */
export function toChipView(chip: ChipSegment, world: ChipWorld, keep = false): ChipView | null {
  switch (chip.kind) {
    case 'log':
      return logChip(chip, world, keep);
    case 'learn': {
      const lesson = LESSON_BY_ID.get(chip.slug);
      if (!lesson) return null;
      return {
        kind: 'learn',
        key: chipKey(chip),
        slug: lesson.id,
        title: lesson.title,
        minutes: lesson.readingMinutes,
        href: ROUTES.lesson(lesson.id),
      };
    }
    case 'quest': {
      const quest = world.quests.find((candidate) => candidate.id === chip.questId);
      if (!quest || quest.claimed) return null;
      return {
        kind: 'quest',
        key: chipKey(chip),
        questId: quest.id,
        title: quest.title,
        progressText: quest.progressText,
        claimable: quest.claimable,
        href: ROUTES.quests,
      };
    }
    case 'break':
      if (!world.breakAvailable) return null;
      return {
        kind: 'break',
        key: chipKey(chip),
        minutes: chip.minutes,
        href: TOUCH_GRASS_LINK,
      };
  }
}

/** What a screen reader hears for a chip, and what a sighted user reads on it. */
export function chipLabel(chip: ChipView): string {
  switch (chip.kind) {
    case 'log':
      return chip.qtyLabel ? `${chip.title} · ${chip.qtyLabel}` : chip.title;
    case 'learn':
      return `Read: ${chip.title}`;
    case 'quest':
      return chip.claimable ? `Claim: ${chip.title}` : `Quest: ${chip.title}`;
    case 'break':
      return `Take ${chip.minutes} min outside`;
  }
}

/** The text of a message and the chips it ends with, checked against the game right now. */
export function readMessage(
  message: Pick<CoachMessage, 'id' | 'content' | 'status'>,
  world: ChipWorld,
  stuck: Readonly<Record<string, string>> = {},
): { text: string; chips: ChipView[] } {
  const streaming = message.status === 'streaming';
  const segments = parseCoachText(message.content, {
    actions: world.actions.keys(),
    quantityLimit: (actionId) => world.actions.get(actionId)?.action.dailyCap,
    streaming,
  });
  const text = segments
    .filter((segment) => segment.type === 'text')
    .map((segment) => segment.text)
    .join('\n\n');
  if (streaming) return { text, chips: [] };
  const chips: ChipView[] = [];
  for (const segment of segments) {
    if (segment.type !== 'chip') continue;
    // A chip already used from this message stays visible as "Stuck".
    const used = stuck[`${message.id}|${chipKey(segment)}`] !== undefined;
    const view = toChipView(segment, world, used);
    if (view) chips.push(view);
  }
  return { text, chips };
}
