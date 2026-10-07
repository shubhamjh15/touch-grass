/**
 * Every word of the landing page, in one place (voice: design bible section 9).
 * Rules this file follows: estimates are "about" or carry the drawn "≈" at the call site;
 * we say "avoided", never "saved" or "offset"; the tree is "it"; nothing here is a number
 * about other people, because there are none to count.
 */
import { BRAND } from '@/lib/brand';
import type { TimelapseFrameId } from './model';

export const HERO = {
  pill: 'No doomscrolling allowed.',
  /** The h1 reads "Grow a living tree by shrinking your footprint." across these parts. */
  titleLead: 'Grow a',
  titleLiving: 'living',
  titleTree: 'tree',
  titleTail: 'by shrinking your footprint.',
  sub: 'Log the climate actions you already take. Get an honest estimate. Watch your tree grow. No account. No doomscrolling.',
  primary: 'Plant your tree',
  secondary: 'Try it first',
  /** Opens the demo world: a tree two hundred days in, in a sandbox that saves nothing. */
  grown: 'See day 200',
} as const;

export const DEMO = {
  title: 'Stick one on',
  hint: 'Tap a sticker. The tree grows, and nothing is saved.',
  tag: 'Demo',
  /** Rest of the tag; visually dropped where the species picker needs the width. */
  tagDetail: ' · sped up',
  speciesLabel: 'Demo tree species',
  speciesShort: 'Tree',
  readoutLabel: 'What the demo printed',
  dragHint: 'Drag to turn',
  receiptTitle: 'Demo receipt',
  receiptMeta: 'Per sticker · nothing saved',
  receiptEmpty: 'Your receipt prints here.',
  about: 'How this number was made',
  stuck: 'Stuck. The demo tree grew.',
  note: "This one's a demo. Yours grows for real, a ring a day. Plant it?",
  noteAction: 'Plant it',
} as const;

export const TICKER = ['Peel', 'Stick', 'Stamp', 'Tear'] as const;

export const PROBLEM = {
  slug: 'The problem',
  title: 'Why good intentions wilt',
  cards: [
    {
      id: 'invisible',
      word: 'Invisible',
      // The figure in this line is computed from the factor table at the call site.
      line: 'Nobody can feel {kg} of CO2e.',
      body: 'That is a {km} km drive you skipped. No sound, no sign, no thank-you. A win you cannot see is hard to repeat.',
    },
    {
      id: 'no-feedback',
      word: 'No feedback',
      line: 'Good intentions last days.',
      body: 'A footprint calculator hands you one verdict and goes quiet. With nothing answering back, a new habit fades before the week is out.',
    },
    {
      id: 'all-doom',
      word: 'All doom',
      line: 'Guilt paralyses.',
      body: 'Most climate news is a countdown. Fear gets your attention, then it gets you to close the tab. A next step works better than another warning.',
    },
  ],
  answerSlug: 'The answer',
  answerTitle: 'So we made it visible.',
  answerBody:
    'Every action you log puts leaves on a tree that is yours. It answers within seconds, grows a ring each day you show up, and never dies.',
} as const;

export const TIMELAPSE = {
  slug: 'Time-lapse',
  title: 'A first year, sped up',
  lead: 'Scroll to grow it. Scroll back up to rewind.',
  footnote:
    'Timings follow a typical pace: six days a week, two or three actions a day. Slower is fine. Growth is never taken away.',
  rulerLabel: 'Stages of the first year',
} as const;

export const TIMELAPSE_CAPTIONS: Record<TimelapseFrameId, { title: string; body: string }> = {
  seed: {
    title: 'You plant it.',
    body: 'A seed, a name and a species. Planting takes about a minute, and there is nothing to sign up for.',
  },
  sprout: {
    title: 'Same day: it sprouts.',
    body: 'Showing up counts on its own. The first ring gives the seed its push before you have logged a thing.',
  },
  seedling: {
    title: 'First true leaves.',
    body: 'Come back once and it is already a seedling. Each action you log adds a few leaves you can count.',
  },
  sapling: {
    title: 'A first crown.',
    body: 'A ball of foliage on a stick. By now you know which actions fit your week, and which never will.',
  },
  young: {
    title: 'Real branches.',
    body: 'About a month in, the trunk forks and the crown fills out. The island around it starts collecting things you earned.',
  },
  mature: {
    title: 'Full canopy.',
    body: 'Thick trunk, deep shade. Miss a few days here and the leaves go thirsty, then perk up the moment you return.',
  },
  grand: {
    title: 'Wide crown, heavy limbs.',
    body: 'Most of a year of small, real-world actions, drawn as one tree. Every ring is a day you showed up.',
  },
  'year-one': {
    title: 'One year in. Still growing.',
    body: 'Nobody finishes the tree. The Elder and Ancient stages are years away, and that is the point.',
  },
};

export const HOW = {
  slug: 'How it works',
  title: 'Three moves, a few seconds each',
  steps: [
    {
      id: 'log',
      word: 'Log',
      line: 'Five seconds.',
      // {actions} and {categories} are counted from the catalogue at the call site.
      body: 'Pick what you did, pick how much, stick it on. {actions} actions in {categories} categories, or write your own.',
    },
    {
      id: 'see',
      word: 'See',
      line: 'An honest number, and new leaves.',
      body: 'You get an estimate of the CO2e you avoided, what it is compared with and where the factor comes from. Then the tree grows.',
    },
    {
      id: 'keep-going',
      word: 'Keep going',
      line: 'A ring a day.',
      body: 'Each day you show up draws a ring. Rain covers a day you miss. Quests, short lessons and a coach hand you the next small step.',
    },
  ],
  sampleLabel: 'Sample quest',
  amountLabel: 'How far',
  amounts: ['2 km', '5 km', '10 km'],
  ringLabel: 'A day ring, two of three actions in',
  rainLabel: 'Rain day banked',
} as const;

export const HONEST = {
  slug: 'Honest numbers',
  title: 'An estimate, and it says so',
  lead: 'Every kilogram in the app is compared with something specific, carries a likely range and names its source. Kilograms never turn into points, so a bigger footprint cannot win.',
  // Short enough to sit beside its figure on a phone; the full action name is on the methodology page.
  rowTitle: '1 km not driven',
  rowMeta: 'Bike or walk',
  ledgerLabel: 'One factor from the table',
  openLabel: 'What the ≈ opens',
  rules: [
    'Two significant figures. An estimate may not claim more.',
    'Self-reported, so we say avoided. Never offset.',
    'Never above the published high value.',
  ],
  link: 'See every number and source',
} as const;

export const KIND = {
  slug: 'Kind by design',
  title: 'It waits for you',
  note: 'Miss a day? It rains. Miss a week? Your tree waits.',
  body: 'Rain covers a missed day by itself and refills every week. Growth, rings, level and badges are never taken away by absence.',
  states: [
    { id: 'thriving', label: 'Thriving', body: 'You showed up. Full colour.' },
    { id: 'thirsty', label: 'Thirsty', body: 'A few days away. One tap fixes that.' },
    { id: 'resting', label: 'Resting', body: 'A week or more away. It kept every ring.' },
  ],
} as const;

export const PRIVATE = {
  slug: 'Private by default',
  title: 'Yours, on this device',
  rows: ['No account.', 'No trackers.', 'Your data stays on this device.'],
  extra: 'Export any time.',
  exception:
    'One thing can leave: a message you choose to send to the coach, with a small context block and never your name.',
  link: 'Read the privacy page',
} as const;

export const TOUR = {
  slug: 'The tour',
  title: "What's inside",
  sampleLabel: 'Sample',
  cards: {
    quests: {
      title: 'Quests',
      line: 'Three a day, three a week.',
      body: 'They track themselves from what you log. Tear the stub to claim.',
    },
    learn: {
      title: 'Learn',
      // {lessons} and {myths} are counted from the bundled content at the call site.
      line: '{lessons} short lessons, {myths} myths.',
      body: 'A couple of minutes each, with sources and a three-question quiz.',
    },
    impact: {
      title: 'Impact',
      line: 'Your numbers, in context.',
      body: 'By category, over time and against your own starting line, beside charts from public datasets.',
    },
    moss: {
      title: 'Moss',
      line: 'A coach that knows your week.',
      body: 'Ask what to do next. Moss suggests; only you log. With no connection, built-in notes answer instead.',
    },
    touchGrass: {
      title: 'Touch grass',
      line: 'The feature that pays you to leave.',
      body: 'Start the timer, put the phone down, go outside. The tree gets a little sunlight for it.',
    },
  },
  questLabel: 'Sample quest',
  mythFlip: 'Flip it',
  mythBack: 'Back to the myth',
  dataNote: 'Bundled data · not live',
  mossQuestion: 'What is one easy thing for today?',
  mossAnswer: 'You already cycle on Tuesdays. Add one plant-based lunch and today is a full ring.',
  mossChip: 'Log a plant-based meal',
  breakLabel: 'A ten-minute Touch grass break',
  breakTime: '10:00',
} as const;

export const FAQ = {
  slug: 'Questions',
  title: 'Fair questions',
  items: [
    {
      id: 'free',
      question: 'Is it free?',
      answer: `Yes. ${BRAND.name} has no price, no ads and nothing to buy inside it. There is no account to upgrade, because there is no account.`,
    },
    {
      id: 'data',
      question: 'Where is my data?',
      answer:
        "In this browser's storage, on this device. No cookies, no analytics, no third parties. You can export everything as a file, or delete it, whenever you like.",
      link: { label: 'Read the privacy page', to: 'privacy' },
    },
    {
      id: 'accuracy',
      question: 'How accurate are the numbers?',
      answer:
        'They are careful estimates, not measurements. Each factor comes from a published source, is shown to two significant figures with a likely range, and is compared with something specific. You report your own actions, so the totals are as honest as the logging.',
      link: { label: 'See every number and source', to: 'methodology' },
    },
    {
      id: 'offline',
      question: 'Does it work offline?',
      answer:
        'Once it has loaded, yes. Your tree, logs, quests and lessons live on the device, so they keep working without a connection. Only the live coach needs the internet.',
    },
    {
      id: 'ai',
      question: 'Do I need the AI?',
      answer:
        'No. Moss, the coach, is optional. When the live coach is not available, built-in notes answer instead and say so. Moss can suggest an action, but only you can log one.',
    },
    {
      id: 'who',
      question: 'Who makes this?',
      answer: `The ${BRAND.team}. Everything the app says about carbon is listed with its source on the Methodology page, and everything about your data is on the Privacy page.`,
    },
  ],
} as const;

export const FINAL = {
  /** Shown once the visitor has grown the demo tree. */
  grownLines: ['Keep the tree', 'you just grew.'],
  /** Shown to a visitor who has not tried the demo: nothing was grown, so we do not say so. */
  freshLines: ['Grow one', 'of your own.'],
  body: 'The demo goes back in the drawer when you leave. Yours stays, and grows a ring every day you show up.',
  action: 'Plant your tree',
  aside: 'About a minute. No account, no email.',
} as const;

export const SPECIES_LABEL = { oak: 'Oak', cherry: 'Cherry', pine: 'Pine' } as const;

/** Text alternative of a stage: what the canvas shows, in words. */
export function stageLabel(species: keyof typeof SPECIES_LABEL, stage: string, demo: boolean) {
  const tree = `${SPECIES_LABEL[species].toLowerCase()} tree on a small floating island`;
  const article = species === 'oak' ? 'An' : 'A';
  return demo
    ? `The demo ${tree}. Stage: ${stage}. It grows when you stick an action on.`
    : `${article} ${tree}, shown as it grows through its first year. Stage: ${stage}.`;
}
