/**
 * Words on /impact. Plain, kind, honest: every figure is an estimate, and we say what it is
 * compared with. No guilt, no scoreboard (bible section 9).
 */
export const COPY = {
  title: 'Impact',
  lead: 'What your small actions add up to, as honest estimates, and the planet they happen on.',
  views: { label: 'Impact view', you: 'Your impact', planet: 'The planet now' },
  totals: {
    label: 'Totals so far',
    hero: 'Avoided so far',
    heroNote: 'Estimated, against what each action replaced.',
    logs: 'Logs',
    rings: 'Rings',
    outside: 'Min outside',
    aiLine: 'Not counted above: AI estimates of your custom actions, about',
  },
  empty: {
    slug: 'NOTHING STUCK YET',
    title: 'No data yet. Log one action and this page wakes up.',
    body: 'It takes about five seconds. The planet’s live readings are already here whenever you want a look.',
    action: 'Log an action',
    planet: 'See the planet right now',
  },
  categories: {
    title: 'By category',
    lead: 'Where your estimated savings come from.',
    caption:
      'Only actions with a sourced factor are counted. Unquantified acts earn XP and show their count.',
    unquantified: 'not quantified',
  },
  trend: {
    title: '12 weeks',
    lead: 'Estimated kg avoided each week, newest at the right.',
    caption: 'Weeks start on Monday. A quiet week is a flat week, not a failed one.',
  },
  heat: {
    title: 'Activity',
    unit: 'One square a day since you planted',
    caption: 'Squares fill as you show up. Rain and rest days keep your streak.',
    legend: {
      full: 'Full ring',
      ring: 'Ring',
      rain: 'Rain day',
      rest: 'Rest day',
      none: 'No ring',
    },
    hint: 'Pick a day to read it.',
    areaLabel: 'Activity by day. Use the arrow keys to move between days.',
  },
  equivalences: {
    title: 'In other words',
    lead: 'A mass of CO2e is hard to picture. These are rough comparisons, never outcomes.',
    receiptTitle: 'In other words',
    totalLabel: 'Avoided so far',
    empty: 'Once you have a total, it turns into things you can picture.',
  },
  pace: {
    title: 'Pace against your starting line',
    lead: 'A projection from your last four weeks, not a measurement.',
    quizAction: 'Take the starting-line quiz',
    infoAction: 'How this is worked out',
    infoTitle: 'About the pace',
    baselineLabel: 'Starting line',
    measuredLabel: 'Logged so far',
    projectedLabel: 'At this pace over a year',
    waitingLabel: 'Active days in the last four weeks',
    overHalf: 'More than half',
  },
  weeks: {
    tab: 'Weeks',
    history: 'History',
    more: 'Show older weeks',
    none: 'Your first weekly recap appears after your first full week.',
    quiet: 'A quiet week. Nothing logged, and that is fine.',
    rings: 'rings',
    logs: 'logs',
    outside: 'min outside',
  },
  history: {
    title: 'Every log, newest first',
    more: 'Show 25 more',
    columnTotal: 'Total, with how each figure is made',
    empty: 'Logs you stick on will be listed here, with undo and delete.',
    delete: 'Delete',
    confirmTitle: 'Delete this log?',
    confirmBody: 'It leaves your totals and your tree’s growth. This cannot be undone.',
    confirmAction: 'Delete log',
    deleted: 'Log deleted.',
    notQuantified: 'Not quantified',
    kinds: { swap: 'Swap', keep: 'Habit', unrated: '' },
  },
  planet: {
    title: 'The planet right now',
    slug: 'THE PLANET RIGHT NOW',
    /** The product name follows this sentence. */
    intro:
      'Measured by NASA, NOAA and the World Bank, and fetched once a day by our server. Your browser only ever talks to',
    loading: 'Fetching the latest readings',
    bundledNotice:
      'The live feed could not be reached, so these are the readings saved with the app.',
    retry: 'Try again',
    errorTitle: 'The readings would not load',
    errorBody: 'Nothing is wrong with your own data. Check your connection and try again.',
    teaserLead: 'The world your actions happen in, measured this week.',
    teaserAction: 'See the planet',
    recordTitle: 'The long record',
    recordLead: 'The same two measurements, as far back as each series goes here.',
    personTitle: 'Per person',
    personLead: 'Where the average person in your place stands, and where you started.',
    youNote:
      'Your bar is your starting line from the quiz: an estimate of a lifestyle footprint, in CO2e.',
    noBaseline: 'Want your own bar here?',
    noRegion:
      'Your region is a wider area the World Bank has no single figure for, so only the world is shown.',
    perPersonNote:
      'National averages include industry and public services, so read the bars as neighbours, not as a like-for-like comparison.',
    allPlaces: 'All places',
    gasesTitle: 'Two more gases',
    gasesLead: 'The next two long-lived greenhouse gases after CO2, measured the same way.',
    contextTitle: 'The bigger picture',
    contextLead:
      'Slower-moving charts saved with the app: the long CO2 record, emissions, and where things are turning.',
    showContext: 'Show the charts',
    hideContext: 'Hide the charts',
    bundled: 'SAVED WITH THE APP',
    groups: {
      problem: {
        title: 'The problem, in two lines',
        lead: 'Sixty years of CO2 in the air, and what we burn each year.',
      },
      turn: { title: 'The turn', lead: 'Where things are getting better, and how fast.' },
    },
  },
  chart: {
    asTable: 'View as table',
    asChart: 'View as chart',
    unavailable: 'Chart unavailable. Here is the table instead.',
    loading: 'Loading chart',
    notes: 'Notes on this data',
    source: 'Source',
    retrieved: 'Retrieved',
    legend: 'Lines shown',
  },
  error: {
    title: 'This page came unstuck',
    body: 'Your data is safe on this device. Try again, or export a copy first.',
  },
} as const;
