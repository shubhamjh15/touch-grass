/**
 * Every string on the Quests page (design bible section 9: playful, direct, kind; paper verbs
 * for what the product does; sentence case; buttons verb-first and at most three words).
 */
import { formatNumber, pluralize } from '@/lib/format';

export const COPY = {
  title: 'Quests',
  lead: 'Small dares that track themselves. Finish one, then tear off its stub.',
  tabsLabel: 'Quest boards',
  tabs: { daily: 'Daily', weekly: 'Weekly', epics: 'Epics' },

  daily: {
    heading: "Today's three",
    idle: 'Log as usual. These fill in by themselves.',
    swept: 'Clean sweep. All three torn off.',
    sweepLabel: 'Clean sweep',
    sweepStamp: 'Clean sweep',
    sweepHint: (xp: number) => `Claim all three for +${formatNumber(xp)} XP on top.`,
    sweepDone: (xp: number) => `+${formatNumber(xp)} XP bonus banked.`,
    nextUp: 'Three new ones at midnight.',
    swapRule: "One swap a day, on a quest you haven't started.",
    swapSpent: "Today's swap is used. A new one arrives at midnight.",
    rollingOver: 'Tearing off yesterday…',
  },
  weekly: {
    heading: "This week's three",
    idle: 'A week is long. These keep count while you get on with it.',
    swept: 'Week cleared. All three torn off.',
    nextUp: 'Three new ones on Monday.',
    progressLabel: 'This week',
    progressHint: 'Tear off all three and the week is cleared.',
    swapRule: "One swap a week, on a quest you haven't started.",
    swapSpent: "This week's swap is used. A new one arrives on Monday.",
    rollingOver: 'Tearing off last week…',
  },

  ready: (count: number) =>
    count === 1
      ? '1 ready. Tear off its stub.'
      : `${formatNumber(count)} ready. Tear off the stubs.`,
  swapShort: 'Swap',
  swapRest: ' this quest',
  swapped: (title: string) => `Swapped. New quest: ${title}.`,
  swapRefused: "That one can't be swapped any more.",
  counts: 'Counts',
  more: (count: number) => `+${formatNumber(count)} more`,
  fewer: 'Show fewer',
  claimRefused: {
    title: "That one isn't finished any more.",
    meta: 'A log was peeled off. Its progress is back on the card.',
  },
  redrawn: {
    title: 'A quest was retired in an update.',
    meta: 'A fresh one took its slot.',
  },
  noBoard: {
    slug: 'No quests drawn',
    title: 'The board is blank.',
    body: 'Quests are drawn fresh each day. Draw them now.',
    action: 'Draw quests',
  },
  honest: 'Quests count what you log. Nothing to tick, nothing to prove.',

  epics: {
    heading: 'Epics',
    meta: 'No deadline',
    lead: 'Real-world projects. Some track themselves from your logs. The rest run on your word.',
    onYourWord: 'On your word',
    fromLogs: 'From your logs',
    ready: 'Ready to claim',
    open: 'In the works',
    finished: 'Finished',
    start: 'Open this epic',
    close: 'Fold it away',
    checklist: 'What it takes',
    noteLabel: 'A note to yourself',
    noteHint: 'Optional. It stays on this device.',
    hold: 'I actually did this',
    holdHint: 'Press and hold for a second and a half.',
    holdEarly: 'Let go too soon. Keep holding until the ring is full.',
    confirmAlt: 'Confirm without holding',
    confirmTitle: 'You actually did this?',
    confirmBody: "We can't check, so this one runs on your word.",
    confirmYes: 'Yes, I did',
    confirmNo: 'Not yet',
    honour: "We can't check these. We take your word for it.",
    xpOnly:
      'XP only. An upgrade keeps paying off for years, so its kilograms stay out of your totals.',
    xpOnlyLink: 'How we count',
    cooldown: (days: number) =>
      `Ready in ${pluralize(days, 'day')}. Big changes take a while; so do we.`,
    weeklyLimit: 'One self-attested epic a week.',
    fillFirst: {
      checklist: 'Tick every job first.',
      note: 'Add your one line first.',
      form: 'Fill in all three lines first.',
      requirement: 'Log it first. Then this unlocks.',
    },
    pin: 'Pin to Today',
    unpin: 'Unpin from Today',
    pinned: 'Pinned to Today',
    pinnedSaid: (title: string) => `${title} is pinned to Today.`,
    unpinnedSaid: (title: string) => `${title} is unpinned.`,
    claimed: (xp: number) => `Claimed. Plus ${formatNumber(xp)} XP.`,
    claimedOn: (date: string, xp: number) => `Claimed ${date} · +${formatNumber(xp)} XP`,
    yourNote: 'Your note',
    emptySlug: 'All twelve done',
    empty: 'Every epic finished. New ones arrive with updates.',
    stamp: 'Done',
  },
} as const;

/** "+50 XP": the reward as printed on a stub or a tag. */
export function xpReward(xp: number): string {
  return `+${formatNumber(xp)} XP`;
}
