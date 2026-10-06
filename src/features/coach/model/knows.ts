/**
 * The "What Moss knows" list: the coach's context for a request, put into plain lines. It
 * is built from the very object the request carries, so the list cannot drift from what is
 * really sent. CO2e totals are named, not quoted: figures belong where their source is.
 */
import type { CoachContext } from '@/ai';
import { formatNumber, pluralize } from '@/lib/format';

export interface KnownLine {
  label: string;
  value: string;
}

function sentence(parts: readonly (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(', ');
}

/** Every field of the context that would leave the device, one line each. */
export function describeContext(context: CoachContext): KnownLine[] {
  const lines: KnownLine[] = [];
  if (context.region) lines.push({ label: 'Region', value: context.region });
  if (context.partOfDay) lines.push({ label: 'Time of day', value: context.partOfDay });
  if (context.tree) {
    const { name, species, stage, vitality } = context.tree;
    const value = sentence([name, species, stage?.toLowerCase(), vitality]);
    if (value) lines.push({ label: 'Tree', value });
  }
  if (context.level !== undefined) {
    lines.push({
      label: 'Progress',
      value: sentence([
        `level ${formatNumber(context.level)}`,
        context.streak !== undefined && `${pluralize(context.streak, 'day')} streak`,
        context.rain !== undefined && pluralize(context.rain, 'rain cloud'),
        context.rings !== undefined && pluralize(context.rings, 'ring'),
      ]),
    });
  }
  if (context.focus && context.focus.length > 0) {
    lines.push({ label: 'Focus', value: context.focus.join(', ') });
  }
  if (context.totals) {
    lines.push({
      label: 'Totals',
      value: sentence([
        context.totals.actionsTotal !== undefined &&
          `${pluralize(context.totals.actionsTotal, 'action')} logged`,
        'estimated kg avoided, overall and in the last 7 days',
      ]),
    });
  }
  if (context.topCategories && context.topCategories.length > 0) {
    lines.push({
      label: 'Top categories',
      value: context.topCategories.map((entry) => entry.category).join(', '),
    });
  }
  if (context.recentActions && context.recentActions.length > 0) {
    lines.push({
      label: 'Recent actions',
      value: context.recentActions.map((entry) => entry.title).join('; '),
    });
  }
  if (context.quests && context.quests.length > 0) {
    lines.push({
      label: 'Quests',
      value: `${pluralize(context.quests.length, 'quest')} in progress`,
    });
  }
  if (context.ringLeft !== undefined) {
    lines.push({
      label: "Today's ring",
      value:
        context.ringLeft === 0 ? 'closed' : `${pluralize(context.ringLeft, 'action')} to close it`,
    });
  }
  if (context.baseline) lines.push({ label: 'Starting line', value: context.baseline });
  if (context.nextLesson) lines.push({ label: 'Next lesson', value: context.nextLesson.title });
  if (context.actions && context.actions.length > 0) {
    lines.push({
      label: 'Action list',
      value: `${pluralize(context.actions.length, 'action')} Moss may suggest${
        context.actions.some((action) => action.doneToday !== undefined)
          ? ', and which are done today'
          : ''
      }`,
    });
  }
  if (context.lessonSlugs && context.lessonSlugs.length > 0) {
    lines.push({
      label: 'Lesson list',
      value: `${pluralize(context.lessonSlugs.length, 'lesson')} Moss may link`,
    });
  }
  return lines;
}
