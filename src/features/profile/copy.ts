/**
 * Every string on the Me page (design bible section 9: playful, direct, kind; sentence case;
 * buttons verb-first and at most three words). The product's name comes from `BRAND`.
 */
import { BRAND } from '@/lib/brand';
import { formatNumber, pluralize } from '@/lib/format';

/** The app version an export file carries (the same default the engine writes). */
export const APP_VERSION = '2.0.0';

export const COPY = {
  title: 'Me',
  lead: "Your tree's passport, your badges and every setting.",
  tabsLabel: 'Me sections',
  tabs: { badges: 'Badges', island: 'Island', settings: 'Settings', data: 'Data' },

  passport: {
    label: 'Tree passport',
    spine: 'Tree passport',
    planted: 'Planted',
    age: 'Tree age',
    streak: 'Best streak',
    outside: 'Outside',
    ageValue: (day: number) => `Day ${formatNumber(day)}`,
    streakValue: (days: number) => pluralize(days, 'day'),
    outsideValue: (minutes: number) => `${formatNumber(minutes)} min`,
    ringsTitle: 'Growth rings',
    ringsLead: 'One ring for every day you showed up. Thick means the day ring closed.',
    ringsMerged: (days: number) => `Each ring on the disc stands for about ${days} days.`,
    stageTo: (from: string, to: string) => `${from} → ${to}`,
    stageLast: (stage: string) => `${stage} · as grown as a tree gets`,
    percentSpoken: (percent: string, to: string) => `${percent} of the way to ${to}`,
    stamp: 'Planted',
  },

  badges: {
    heading: 'Badges',
    count: (earned: number, total: number) => `${earned} of ${total}`,
    tiers: (earned: number, total: number) => `${formatNumber(earned)} of ${total} tiers`,
    filterLabel: 'Show badges',
    filters: { all: 'All', earned: 'Earned', locked: 'Locked' },
    gridLabel: 'Badges',
    nextSlug: 'Closest badge',
    nextLine: (name: string, text: string) => `${name} · ${text}`,
    nextAction: 'Log an action',
    firstRun: 'Log one action to earn First Leaf and open the first flowers on your island.',
    allEarned: 'Every badge earned. The island is complete.',
    nothingEarned: {
      slug: 'Nothing earned yet',
      title: 'Your first badge is one action away.',
      body: 'Log anything and First Leaf is yours, with flowers on the island to prove it.',
      action: 'Log an action',
    },
    nothingLocked: {
      slug: 'All stamped',
      title: 'Every badge is in the passport.',
      body: 'Nothing left to chase. Keep the streak going anyway.',
    },
    secretName: 'Secret badge',
    detail: {
      earnedOn: (date: string) => `Earned ${date}`,
      locked: 'Not earned yet',
      tiersHeading: 'Tiers',
      tierLine: (numeral: string) => (numeral ? `Tier ${numeral}` : 'The badge'),
      xp: (xp: number) => `+${formatNumber(xp)} XP`,
      brings: (names: string) => `Brings: ${names}`,
      onIsland: 'On your island',
      progress: 'Progress',
      done: 'All tiers earned',
      close: 'Close',
    },
    openLocked: (name: string) => `${name}, not earned yet. Show how to earn it`,
    openSecret: 'Secret badge. Show the riddle',
  },

  island: {
    logHeading: 'What has arrived',
    logLead: 'Everything that arrived on the island, in words, newest first.',
    logLabel: 'Island log',
    dayChip: (day: number) => `Day ${formatNumber(day)}`,
    arrivedHeading: 'Still to arrive',
    arrivedLead: (left: number) =>
      left === 0
        ? 'Everything has arrived.'
        : `${pluralize(left, 'thing')} left to earn. Each one comes from a badge.`,
    arrivedLabel: 'Island props still to arrive',
    count: (have: number, total: number) => `${have} of ${total} on the island`,
    empty: {
      slug: 'Nothing here yet',
      title: 'The island log starts when you plant.',
      body: 'Log an action and the first line writes itself.',
    },
    complete: {
      slug: 'Island complete',
      title: 'All sixteen are on the island.',
      body: 'The tree, your levels and the badges carry the long game from here.',
    },
  },

  settings: {
    you: { heading: 'You and your tree', label: 'You and your tree settings' },
    experience: { heading: 'Experience', label: 'Experience settings' },
    coach: { heading: 'Coach', label: 'Coach settings' },

    name: { label: 'Your name', hint: 'Stays on this device.', placeholder: 'Friend' },
    treeName: { label: "Tree's name", hint: 'Up to 16 characters.' },
    species: {
      label: 'Species',
      hint: 'Re-plant as another species any time. Growth, rings and seed are kept.',
      options: { oak: 'Oak', cherry: 'Cherry', pine: 'Pine' },
      done: (species: string) => `Re-planted as ${species}.`,
    },
    focus: {
      label: 'Focus areas',
      hint: 'Pick one to three. Quests and the Log lean toward them.',
      full: 'Three is the most. Drop one to pick another.',
      atLeastOne: 'Keep at least one.',
    },
    region: {
      label: 'Region',
      hint: 'Sets the electricity grid behind your estimates.',
    },
    heat: {
      label: 'Heating and hot water',
      hint: 'Used for home-energy estimates.',
      options: {
        unknown: 'Not sure',
        gas: 'Gas or oil',
        electric: 'Electricity',
        'heat-pump': 'Heat pump',
        none: "We don't heat",
      },
    },
    units: { label: 'Units', options: { metric: 'Metric', imperial: 'Imperial' } },
    rest: {
      label: 'Rest days',
      hint: 'Up to three weekdays that never break your streak. Changes start next Monday.',
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      daysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      none: 'No rest days',
      pending: (days: string, from: string) => `From ${from}: ${days}.`,
      pendingNone: (from: string) => `From ${from}: no rest days.`,
      current: (days: string) => `Now: ${days}.`,
      full: 'Three is the most.',
    },
    hidden: {
      label: 'Hidden actions',
      none: 'Nothing hidden. Tap Not for me on an action in the Log to tidy the grid.',
      count: (n: number) => `${pluralize(n, 'action')} hidden from the Log.`,
      manage: 'Manage',
      title: 'Hidden actions',
      lead: 'These stay out of your Log grid. Bring one back any time.',
      unhide: 'Show again',
      unhideOne: (title: string) => `Show ${title} again`,
      close: 'Done',
    },

    sound: { label: 'Sound', hint: 'Taps, stamps and chimes.' },
    haptics: { label: 'Haptics', hint: 'A small buzz on phones that have one.' },
    motion: {
      label: 'Motion',
      hint: 'System follows your device. Reduced calms the world and the page.',
      options: { system: 'System', reduced: 'Reduced', full: 'Full' },
    },
    graphics: {
      label: '3D quality',
      hint: 'Auto picks what your device can hold. Still shows the illustrated tree.',
      options: {
        auto: 'Auto',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        off: 'Still illustration',
      },
      noWebgl: "This browser can't run 3D, so the illustrated tree shows whatever you pick.",
    },
    sky: {
      label: 'Sky',
      hint: 'Follow local time darkens the world at night.',
      options: { local: 'Local time', day: 'Always day' },
    },
    celebrations: {
      label: 'Celebrations',
      hint: 'Subtle keeps the moments, without the big ones.',
      options: { full: 'Full', subtle: 'Subtle' },
    },

    coachStatus: {
      label: 'Coach',
      checking: 'Checking which coach is on…',
      live: (provider: string) => `Live coach connected${provider ? ` (${provider})` : ''}.`,
      builtIn: 'Built-in coach. No AI key on this server, and it still answers.',
      offline: "You're offline. The built-in coach is answering.",
      open: 'Open the coach',
    },
    share: {
      label: 'Share my stats with the coach',
      hint: 'A small summary of your week goes with each question. Your name never does.',
    },
    clearChat: {
      label: 'Chat history',
      hint: 'Kept on this device only.',
      action: 'Clear chat',
      title: 'Clear the coach chat?',
      body: 'Every message with the coach is deleted from this device. Logs and badges are untouched.',
      confirm: 'Clear chat',
      done: 'Coach chat cleared.',
    },

    line: {
      heading: 'Your starting line',
      label: 'Starting line',
      lead: 'Six questions give a rough yearly footprint, so your pace has something to be measured against.',
      none: {
        slug: 'No starting line yet',
        title: 'Take the quiz when you have a minute.',
        body: 'Six questions, about a minute. It stays on this device.',
        action: 'Take the quiz',
      },
      taken: (date: string) => `Taken ${date}`,
      total: 'a year',
      retake: 'Retake',
      clear: 'Clear',
      retakes: (n: number) => (n === 0 ? '' : `${pluralize(n, 'earlier result')} kept.`),
      clearTitle: 'Clear your starting line?',
      clearBody: 'The result and its history are deleted. Logs are untouched.',
      clearConfirm: 'Clear it',
      quizTitle: 'Starting-line quiz',
      quizLead: 'Pick the nearest answer. Nothing leaves this device.',
      progress: (index: number, total: number) => `Question ${index} of ${total}`,
      back: 'Back',
      next: 'Next',
      save: 'Save result',
      useFocus: 'Also adopt the suggested focus areas',
      saved: 'Starting line saved.',
      cleared: 'Starting line cleared.',
    },

    about: {
      heading: 'About',
      label: 'About this app',
      app: 'App',
      content: 'Content',
      factors: 'Factors',
      methodology: 'How we calculate',
      privacy: 'What stays on your device',
      licences: 'Open-source credits',
      report: 'Report a problem',
      reportHref: `${BRAND.repoUrl}/issues`,
      credits: {
        title: 'Open-source credits',
        lead: 'Touch Grass stands on these projects. Each is used under its own licence.',
        close: 'Close',
        items: [
          ['Next.js and React', 'MIT'],
          ['three.js and React Three Fiber', 'MIT'],
          ['Zustand', 'MIT'],
          ['Radix UI', 'MIT'],
          ['Tailwind CSS', 'MIT'],
          ['Motion', 'MIT'],
          ['Lucide icons', 'ISC'],
          ['Recharts', 'MIT'],
          ['Space Grotesk, Tilt Warp and Martian Mono', 'SIL Open Font Licence'],
        ] as const,
      },
    },
  },

  data: {
    exportHeading: 'Take it with you',
    exportLead: 'One file holds your whole tree. It is yours: keep it, move it, or hand it back.',
    exportJson: 'Export JSON',
    exportJsonHint: 'Everything: tree, logs, badges, settings.',
    exportCsv: 'Export CSV',
    exportCsvHint: 'Your logs, one row each, for a spreadsheet.',
    includeCoach: 'Include coach chats',
    exported: (file: string) => `Saved ${file}.`,
    exportFailed: "The browser wouldn't save the file. Copy it as text instead.",
    copyText: 'Copy as text',
    copied: 'Copied.',
    copyFailed: 'Copy failed. Select the text and copy it by hand.',
    fallbackLabel: 'Your export, as text',
    noLogs: 'No logs yet, so the CSV would only hold its header row.',

    importHeading: 'Bring a save back',
    importLead:
      'Choose a file you exported before. You will see what is in it before anything is replaced.',
    importChoose: 'Choose a file',
    importAccepts: 'Only .json files exported from Touch Grass.',
    importFileLabel: 'Choose an export file to import',
    importFailedTitle: "That file wasn't imported",
    importNothing: 'Nothing was changed.',
    importDetails: 'Technical detail',
    importPreviewTitle: 'Replace this device’s data?',
    importPreviewLead: 'This file holds:',
    importMismatch:
      'This file was edited outside Touch Grass. You can still use it, but the numbers are not guaranteed.',
    importExportedAt: (when: string) => `Exported ${when}.`,
    importWarning:
      'Your current tree, logs and settings will be replaced. Level, growth and props are rebuilt from the file.',
    importTypeLabel: (word: string) => `Type “${word}” to confirm`,
    importConfirm: 'Replace data',
    importCancel: 'Keep mine',
    imported: (tree: string) => `${tree} is back. Data replaced.`,

    deviceHeading: 'On this device',
    storage: 'Stored here',
    storageValue: (size: string) => `${size} in this browser`,
    memoryWarning: 'Private window: nothing survives a reload. Export before you close this tab.',
    saveFailed: 'The browser has no room left to save. Your tree lives on in this tab: export now.',
    install: 'Install the app',
    installHint: 'Opens like any other app, and works offline.',
    installed: 'Installed. It opens on its own.',
    legacyHeading: 'Old app backup',
    legacyHint: 'A raw copy of the data from the old version, kept until you delete it.',
    legacyDownload: 'Download',
    legacyDelete: 'Delete',
    legacyDeleteTitle: 'Delete the old backup?',
    legacyDeleteBody: 'The raw copy of the old app’s data is deleted from this device.',
    legacyDeleted: 'Old backup deleted.',

    resetHeading: 'Start over',
    resetLead:
      'Deletes everything Touch Grass keeps on this device and takes you back to the start.',
    resetOpen: 'Reset Touch Grass',
    resetTitle: 'Reset Touch Grass?',
    resetWhat: [
      'Your tree, rings and growth',
      'Every log, quest, lesson and badge',
      'Your journal, starting line and settings',
      'The coach chat',
    ],
    resetCannotUndo: 'This cannot be undone. Export first if there is any chance you want it back.',
    resetExportFirst: 'Export first',
    resetTypeLabel: (tree: string) => `Type “${tree}” to confirm`,
    resetTypeHint: "Your tree's name, as a lock against a stray tap.",
    resetConfirm: 'Reset everything',
    resetKeep: 'Keep my data',
    resetNeedsName: "Type the tree's name to unlock this.",
  },
} as const;

/** The seven weekdays as "Mon, Wed", for a sentence. */
export function listDays(days: readonly number[]): string {
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => COPY.settings.rest.days[day] ?? '')
    .join(', ');
}
