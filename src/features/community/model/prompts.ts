import { JOURNAL_PROMPT_COUNT, journalPromptIndex } from '@/game';
import type { DayKey } from '@/lib/dates';

/** The twelve prompts of the week. One seeds the composer, chosen by week index. */
export const WEEKLY_PROMPTS: readonly string[] = [
  'What was easier than you expected this week?',
  'What did you do this week without having to think about it?',
  'Which small habit surprised you by sticking?',
  'What got in the way this week, and what would make it easier next time?',
  'Where did you spend time outside, and how did it feel?',
  'What did you choose not to buy or throw away?',
  'Which meal this week would you happily make again?',
  'What would you tell a friend who wants to start?',
  'What felt like effort at first and now feels normal?',
  'What did you learn this week that you did not know before?',
  'Who or what made a good habit easier this week?',
  'What is one tiny thing you want to try next week?',
];

export function promptOfTheWeek(day: DayKey): string {
  const index = journalPromptIndex(day) % JOURNAL_PROMPT_COUNT;
  return WEEKLY_PROMPTS[index] ?? (WEEKLY_PROMPTS[0] as string);
}
