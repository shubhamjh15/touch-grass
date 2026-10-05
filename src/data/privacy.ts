/**
 * Content of the /privacy page. It states exactly what is stored and where, the only things
 * that can leave the device, and how to export and delete. The storage keys here are the ones
 * the app writes; a test in `content.test.ts` keeps this list and the spec's glossary together.
 */

export type StorageArea = 'localStorage' | 'sessionStorage' | 'cacheStorage';

export interface StoredItem {
  id: string;
  area: StorageArea;
  /** The key the browser stores it under, or null for the offline file cache. */
  key: string | null;
  /** What it holds, in plain words. */
  holds: readonly string[];
  /** Whether it can leave the device. For stored items this is always false: see PRIVACY_LEAVES. */
  leavesDevice: false;
  /** How a person removes it. */
  howToDelete: string;
}

export interface LeavesItem {
  id: string;
  /** When it happens. */
  when: string;
  /** What is sent. */
  sends: readonly string[];
  /** Where it goes. */
  to: string;
  /** Whether the user can switch it off or avoid it. */
  control: string;
}

export type PrivacyBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'note'; text: string };

export interface PrivacySection {
  id: string;
  heading: string;
  summary: string;
  blocks: readonly PrivacyBlock[];
}

/** What lives on the device, and under which key. */
export const PRIVACY_STORED: readonly StoredItem[] = [
  {
    id: 'game',
    area: 'localStorage',
    key: 'touchgrass:game',
    holds: [
      'Your profile: name, tree name and species, region, focus areas and settings.',
      'Everything you log, with the estimate it got, plus your streak, rings, quests, badges and lesson progress.',
      'Your starting-line answers and results, your journal notes, saved custom actions and any challenge you accepted.',
      'Touch Grass breaks and your recent activity.',
    ],
    leavesDevice: false,
    howToDelete:
      'Me, then Data, then "Reset Touch Grass". Or clear this site\'s data in your browser.',
  },
  {
    id: 'coach',
    area: 'localStorage',
    key: 'touchgrass:coach',
    holds: ['Your conversation with the coach: your messages and its answers.'],
    leavesDevice: false,
    howToDelete: 'Me, then Coach, then "Clear chat history".',
  },
  {
    id: 'ui',
    area: 'localStorage',
    key: 'touchgrass:ui',
    holds: [
      'Small interface conveniences, such as the tab you last used or a draft you have not sent.',
    ],
    leavesDevice: false,
    howToDelete: "Reset Touch Grass, or clear this site's data in your browser.",
  },
  {
    id: 'legacy-backup',
    area: 'localStorage',
    key: 'touchgrass:legacy-backup',
    holds: [
      'A copy of the data an earlier version of this app saved in this browser, kept in case you want it back, if you chose to bring it over.',
    ],
    leavesDevice: false,
    howToDelete: 'Me, then Data, then "Delete legacy backup".',
  },
  {
    id: 'demo-carry',
    area: 'sessionStorage',
    key: 'demoCarry',
    holds: [
      'Which tree species and first action you tried on the landing page, so we can offer it as your first log. It lasts until you close the tab.',
    ],
    leavesDevice: false,
    howToDelete: 'Closing the tab removes it.',
  },
  {
    id: 'pending-challenge',
    area: 'sessionStorage',
    key: null,
    holds: [
      'A challenge link you opened before finishing onboarding, held until you accept it afterwards. It lasts until you close the tab.',
    ],
    leavesDevice: false,
    howToDelete: 'Closing the tab removes it.',
  },
  {
    id: 'offline-files',
    area: 'cacheStorage',
    key: null,
    holds: [
      "Touch Grass's own files (pages, scripts, fonts and the bundled public data), so the app opens without a network.",
    ],
    leavesDevice: false,
    howToDelete: "Clear this site's data in your browser, or uninstall the app.",
  },
];

/** The only things that can leave the device. */
export const PRIVACY_LEAVES: readonly LeavesItem[] = [
  {
    id: 'coach-live',
    when: 'Only when you send a message to the live coach, and only if the server has an AI key set. Without one, the built-in coach answers on your device and nothing is sent.',
    sends: [
      'The text of your message and the last few turns of the conversation.',
      "A small block of facts about your progress (tree stage and vitality, level, streak, focus areas, region, today's logged actions, a weekly summary by category, quest progress, lessons passed, and your starting-line total and pace if you took the quiz).",
    ],
    to: "Touch Grass's own /api service, which relays it to the AI provider the site is configured with. The key lives on the server and never reaches your browser. Nothing is stored on the server.",
    control:
      'Switch off "Share my stats with the coach" in Me, and the block shrinks to your region. Or do not use the live coach.',
  },
  {
    id: 'estimate',
    when: 'Only when you describe a custom action that is not in the catalogue and the live AI is available.',
    sends: [
      'The short description you typed and the quantity.',
      'Your region and the titles of catalogue actions, so the model can match it to one.',
    ],
    to: "Touch Grass's own /api service, then the same AI provider.",
    control:
      'You can pick a category and effort level yourself instead. You always see and can edit the result before saving.',
  },
  {
    id: 'hosting',
    when: 'Every time you open the site, as with any website.',
    sends: [
      "An ordinary request for the app's files, which the host that serves Touch Grass can see (your IP address and browser type). Touch Grass adds nothing to it.",
    ],
    to: 'The host that serves this site.',
    control: 'Once the app is cached it opens without a network, apart from the live coach.',
  },
];

/** Things that are never sent, even when the live coach or a custom estimate is used. */
export const PRIVACY_NEVER_SENT: readonly string[] = [
  'Your name. The browser swaps it into replies locally.',
  'Your journal notes.',
  'Your starting-line answers, as raw answers.',
  'Your full log history, timestamps and device identifiers.',
  'Custom-action text from other days.',
];

/** Things Touch Grass does not do. */
export const PRIVACY_NOT_USED: readonly string[] = [
  'No cookies.',
  'No analytics, tracking pixels or advertising.',
  'No accounts, so there is nothing to sign in to.',
  'No fonts, scripts or images loaded from other websites.',
  'No selling or sharing of data, because we do not receive any.',
];

export interface ExportStep {
  title: string;
  steps: readonly string[];
}

export const PRIVACY_EXPORT: ExportStep = {
  title: 'Export your data',
  steps: [
    'Open Me, then Data.',
    'Choose "Export JSON" to save everything on this device in one file, named touch-grass-YYYY-MM-DD.json. Coach chats are left out unless you tick "Include coach chats".',
    'Choose "Export logs as CSV" for a spreadsheet of what you logged.',
  ],
};

export const PRIVACY_DELETE: ExportStep = {
  title: 'Delete your data',
  steps: [
    'Open Me, then Data, then "Reset Touch Grass". It lists what will be deleted and offers an export first.',
    "Type your tree's name to confirm. Everything under the touchgrass: keys, and any keys left by an earlier version of the app, is removed, and you return to the start.",
    'Smaller resets exist: clear the coach chat, clear the journal, clear the starting line.',
    "You can also clear this site's data from your browser settings. Because nothing is kept on a server, that deletes everything.",
  ],
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: 'short-version',
    heading: 'The short version',
    summary: 'Your data lives on your device. Almost nothing leaves it.',
    blocks: [
      {
        kind: 'p',
        text: "Touch Grass has no accounts. What you log, write and learn is saved in your browser on this device, and you can export or delete it whenever you like. The only thing that can leave the device is what you send to the live coach or ask it to estimate, and it goes through Touch Grass's own service to the AI provider the site is configured with.",
      },
      {
        kind: 'note',
        text: 'Because nothing is stored on a server, we cannot recover your data if you clear your browser. Export a copy now and then.',
      },
    ],
  },
  {
    id: 'stored',
    heading: 'What is stored on your device',
    summary: 'Every key, and what is in it.',
    blocks: [
      {
        kind: 'p',
        text: 'These are the places Touch Grass writes to in your browser. None of them is sent anywhere by itself.',
      },
    ],
  },
  {
    id: 'leaves',
    heading: 'What can leave your device',
    summary: 'Coach messages, custom estimates, and the ordinary request for the site.',
    blocks: [
      {
        kind: 'p',
        text: 'Nothing leaves the device in the background. These are the only three cases, and what is in each.',
      },
    ],
  },
  {
    id: 'never-sent',
    heading: 'What is never sent',
    summary: 'Even when the coach is live.',
    blocks: [{ kind: 'list', items: PRIVACY_NEVER_SENT }],
  },
  {
    id: 'not-used',
    heading: 'What Touch Grass does not do',
    summary: 'No cookies, no trackers, no third parties.',
    blocks: [{ kind: 'list', items: PRIVACY_NOT_USED }],
  },
  {
    id: 'links-and-cards',
    heading: 'Share cards and challenge links',
    summary: 'Made on your device, and built to keep your data in your hands.',
    blocks: [
      {
        kind: 'p',
        text: "Your share card is drawn on your device, and it goes nowhere unless you send it yourself with your device's share sheet. A challenge link keeps everything it needs after the # in the address, a part that browsers never send to a server. Before you share a link you can see exactly what it contains, and it never includes your journal or your starting line.",
      },
    ],
  },
  {
    id: 'ai-answers',
    heading: 'About the AI coach',
    summary: 'Answers can be wrong, and you decide what gets logged.',
    blocks: [
      {
        kind: 'p',
        text: 'AI answers are labelled, and numbers in them should be checked against the methodology page. The coach can suggest an action, but nothing is ever logged until you confirm it.',
      },
    ],
  },
];
