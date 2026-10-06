/**
 * Every sentence the Today page says for itself. Tree status lines, notices and quest copy
 * come from the game; these are the page's own words, in the voice of bible section 9.
 */
import { BREAK_AWAY_SHARE, BREAK_MIN_GAP_MIN, BREAK_MIN_KEPT_MIN } from '@/game';
import { formatNumber, formatPercent } from '@/lib/format';

export const COPY = {
  dockLabel: 'Today',
  stickHeading: 'Stick one on',
  questsHeading: "Today's quests",
  allQuests: 'All quests',
  cleanSweep: 'Clean sweep. All three torn off.',
  explore: 'Explore the island',
  exploreShort: 'Explore',
  exploreDone: 'Done',
  exploreHint: 'Drag the island to turn it. Every landmark is a way in.',
  logAction: 'Log an action',
  maxed: 'Maxed',
  maxedNote: 'Maxed for today. This one adds kilograms, not XP.',
  undo: 'Undo',
  peeled: 'Peeled off. Back to how it was.',
  undoExpired: 'That one has set. You can still remove it from the Log page.',
  askMoss: 'Ask Moss',
  factSlug: 'Daily fact',
  factMore: 'Tell me more',
  clockSkew: 'Your clock looks off. Today will catch up.',
  memoryOnly: "Private window: progress won't be saved.",
  saveFailedTitle: 'This device is out of room',
  saveFailedBody:
    "New changes can't be kept on this device right now. Everything so far is safe. Export a copy, then free up some space.",
  recapReady: "Last week's page is torn off and ready.",
  recapSeeIt: 'See the recap',
  recapTitle: 'Last week',
  nextHeading: 'Next up',
  nextTip: 'A tip',
  nextFact: "Today's fact",
  activityHeading: 'Recent activity',
  activityAll: 'See all',
  activityEmpty: 'Nothing stuck yet today. Your first action is one tap away.',
  activityHistory: 'See your whole history',
  activityNoXp: 'no XP, maxed for today',
  activityNoEstimate: 'Not estimated',
} as const;

export function waterLabel(treeName: string, dormant: boolean): string {
  return dormant ? `Wake ${treeName} up` : `Water ${treeName}`;
}

export function wateredAnnouncement(treeName: string, ring: number, implicit: boolean): string {
  return implicit
    ? `First act today. ${treeName} is watered. Ring ${formatNumber(ring)} drawn.`
    : `${treeName} is watered. Ring ${formatNumber(ring)} drawn.`;
}

export function stuckTitle(treeName: string, leaves: number, firstActToday: boolean): string {
  return firstActToday
    ? `First act today. ${treeName} is watered.`
    : `Stuck. ${treeName} grew ${formatNumber(leaves)} leaves.`;
}

/** The Touch grass break, in the words of product spec section 10. */
export const BREAK_COPY = {
  slug: 'Touch grass',
  cardTitle: 'Leave the screen. Get paid for it.',
  start: 'Start a break',
  noPermissions: 'No permissions needed',
  startNow: 'Start the break',
  line: (tree: string) => `Phone down. Sky up. ${tree} will keep an eye on things.`,
  away: [
    'Nothing to see here. Literally.',
    (tree: string) => `Go on. ${tree} photosynthesises better when you're not watching.`,
  ] as const,
  night: 'Stars count as grass.',
  safety: "Only if it's safe and you're up for it. An open window and the sky count.",
  rules: `It counts when the time is up and you were away from the screen for at least ${formatPercent(BREAK_AWAY_SHARE)} of it. A peek or two is fine.`,
  noSensors: 'No GPS, no step counter, no camera. No permissions at all, on purpose.',
  endingEarly: `Ending early? ${formatNumber(BREAK_MIN_KEPT_MIN)} minutes or more still counts as a ${formatNumber(BREAK_MIN_KEPT_MIN)}-minute break.`,
  gap: `Breaks sit at least ${formatNumber(BREAK_MIN_GAP_MIN)} minutes apart.`,
  back: "I'm back",
  endEarly: 'End early',
  timeUp: "Time's up. Whenever you're ready.",
  doneTitle: '☀️ Break done',
  returnTitle: 'Welcome back. How was the sky?',
  outside: 'Went outside',
  rested: "Couldn't get out, rested off-screen",
  none: "Didn't really take a break",
  noneReply: 'No worries. The grass will still be there.',
  tooShort: 'Even two minutes is nice. Ten makes it a break.',
  notAway:
    "The screen stayed busy for most of that one, so it isn't counted. No worries. The grass will still be there.",
  rewarded: (xp: number, tree: string) =>
    `+${formatNumber(xp)} XP · ${tree} soaked up the sun you brought back.`,
  recorded: (minutes: number) =>
    `${formatNumber(minutes)} minutes outside, recorded. Today's break XP was already in.`,
  noticeLabel: 'Notice one thing?',
  noticeHint: 'Optional. Saved to your journal on this device.',
  noticePlaceholder: 'A bird, a smell, the colour of the sky…',
  noticeSave: 'Save the note',
  noticeSaved: 'Saved to your journal.',
  done: 'Back to the grove',
  stamp: 'Touched grass',
  alreadyRewarded: "Today's break XP is in. Another break still adds minutes outside.",
  cooldown: (minutes: number) => `Next break in ${formatNumber(minutes)} min`,
} as const;

/** The three one-time pointers of the first day (product spec 11.3, step 8). */
export const COACH_MARKS = [
  {
    target: 'tree',
    title: 'This is your tree',
    body: (tree: string) =>
      `${tree} grows a ring every day you show up, and new leaves each time you log. Its tag always says how it is doing.`,
  },
  {
    target: 'ring',
    title: 'One ring a day',
    body: () =>
      'Three actions close the day’s ring. Quests are optional extras: finish one, then tear off its stub.',
  },
  {
    target: 'log',
    title: 'Stick one on',
    body: () =>
      'One tap logs an action you actually did. The Log page holds every action, with the sums behind each estimate.',
  },
] as const;

export type CoachMarkTarget = (typeof COACH_MARKS)[number]['target'];
