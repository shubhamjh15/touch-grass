/**
 * Words on /methodology and /privacy that the data modules do not hold: page leads, section
 * titles, and the plain names of the things the privacy page lists by id.
 */
import { BRAND } from '@/lib/brand';

export const METHODOLOGY_COPY = {
  title: 'Methodology',
  lead: 'Every number in Touch Grass is an estimate. This page shows how each one is made, what it is compared with, how sure we are and where it comes from.',
  tryTitle: 'Tap the mark to see how a number is made',
  tryBody:
    'Every figure in the app carries this mark. It opens the formula, the comparison, the likely range and the source, just as the table below lists them.',
} as const;

/** The live figures on the Impact page: not part of your total, but part of what we owe an explanation for. */
export const PLANET_FIGURES = {
  id: 'planet-figures',
  heading: 'The world figures on Impact',
  summary:
    'Live readings from public sources, shown beside your own numbers and never added to them.',
  paragraphs: [
    'The world view of the Impact page shows public climate data. Some charts are datasets bundled with the app, so they work offline; they are listed under Sources. Five readings are fetched live: global temperature, CO2, methane and nitrous oxide in the air, and CO2 per person. They come from the publishers named below, through our own server, so your browser never contacts them.',
    'The server keeps each answer for a day and checks it before use: a reading that is the wrong shape, outside a physically sensible range or too old is treated as if the source were down. When that happens, or when you are offline, the page shows a snapshot saved with the app, labelled with its date. The "Live" badge appears only on a reading fetched within the last day and a half.',
    'These figures give context. They are not used in any of your totals, ranges or equivalences.',
  ],
  items: [
    {
      what: 'Global surface temperature',
      detail: 'Monthly change against the 1951 to 1980 average, land and ocean.',
      source: 'GISTEMP v4, NASA Goddard Institute for Space Studies',
      url: 'https://data.giss.nasa.gov/gistemp/',
    },
    {
      what: 'Carbon dioxide in the air',
      detail: 'Global daily average in parts per million, with and without the seasons.',
      source: 'NOAA Global Monitoring Laboratory',
      url: 'https://gml.noaa.gov/ccgg/trends/gl_trend.html',
    },
    {
      what: 'Methane and nitrous oxide in the air',
      detail: 'Global monthly averages in parts per billion.',
      source: 'NOAA Global Monitoring Laboratory',
      url: 'https://gml.noaa.gov/ccgg/trends_ch4/',
    },
    {
      what: 'CO2 per person',
      detail:
        'Territorial emissions per person for the world and your region, without land-use change. The latest year each country has reported.',
      source: 'World Bank, World Development Indicators (EN.GHG.CO2.PC.CE.AR5)',
      url: 'https://data.worldbank.org/indicator/EN.GHG.CO2.PC.CE.AR5',
    },
  ],
} as const;

export const CONTENTS = [
  { id: 'idea', label: 'The idea' },
  { id: 'confidence', label: 'How sure we are' },
  { id: 'regions', label: 'Where you live' },
  { id: 'factors', label: 'Every factor' },
  { id: 'sources', label: 'Sources' },
  { id: 'other-numbers', label: 'The other numbers' },
  { id: 'limits', label: 'What we do not claim' },
  { id: 'wording', label: 'How we word numbers' },
  { id: 'versions', label: 'Versions and changes' },
] as const;

export const PRIVACY_COPY = {
  title: 'Privacy',
  lead: `${BRAND.name} has no accounts and no trackers. What you log lives on this device, and you can take it with you or wipe it at any time.`,
  contents: [
    { id: 'your-data', label: 'Your data, in your hands' },
    { id: 'stored', label: 'What is on your device' },
    { id: 'leaves', label: 'What can leave it' },
    { id: 'promises', label: 'What we never do' },
    { id: 'how-to', label: 'Export and delete' },
    { id: 'more', label: 'Cards, links and the coach' },
  ],
  summary: [
    { label: 'STORED', value: 'On this device', note: 'in your browser, nowhere else' },
    { label: 'LEAVES', value: 'Only coach messages', note: 'and only when you send one' },
    { label: 'TRACKERS', value: 'None', note: 'no cookies, no analytics' },
  ],
} as const;

/** The plain names of the stored items, by id. */
export const STORED_NAMES: Readonly<Record<string, string>> = {
  game: 'Your tree and everything you log',
  coach: 'Coach conversation',
  ui: 'Small interface settings',
  'legacy-backup': 'Backup from an earlier version',
  'demo-carry': 'Landing-page try-out',
  'pending-challenge': 'A challenge link waiting for you',
  'offline-files': 'Files for offline use',
};

/** The plain names of the things that can leave the device, by id. */
export const LEAVES_NAMES: Readonly<Record<string, string>> = {
  'coach-live': 'Messages to the live coach',
  estimate: 'Estimates for a custom action',
  hosting: 'Opening the site',
};

export const YOUR_DATA = {
  title: 'Take it with you, or wipe it',
  using: (size: string) =>
    `Touch Grass is using about ${size} of this browser's storage. Nothing here is on a server, so these two buttons are the whole story.`,
  deleteHint:
    'Deleting removes your tree, every log, your quizzes and your coach chats from this device, and starts you over.',
  confirm:
    'This erases your tree, every log and your coach chat from this device. It cannot be undone. Export a copy first if you want one.',
  deleted: 'Everything was deleted from this device. You are back at the start.',
  emptyTitle: 'Nothing is saved on this device yet',
  emptyBody:
    'Once you plant a tree, everything you log is kept here in your browser, and this is where you can export or delete it.',
} as const;
