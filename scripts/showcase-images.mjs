#!/usr/bin/env node
/**
 * Makes the gallery images for a submission page: eleven designed cards, 2400 x 1600 (3:2),
 * in docs/showcase/, and the README.md next to them that lists each file with its caption.
 *
 *   node scripts/showcase-images.mjs [card ...] [options]
 *
 * With no card named, all eleven are made. A card is named by its number: `03 06`.
 *
 * Options
 *   --base <url>     Server origin (default http://localhost:5173). The cover and the growth
 *                    card use the world lab, which only exists in a development build.
 *   --out <dir>      Where the images and README.md go (default docs/showcase)
 *   --work <dir>     Working folder for the raw captures and the card pages (default
 *                    showcase-out; it is in .gitignore)
 *   --reuse          Do not capture again what is already in the working folder: for work on
 *                    the layout of a card
 *   --tests <n>      The number of unit tests to print on card 11. Without it the script asks
 *                    Vitest (`npx vitest list`), which takes a minute or two.
 *   --question <q>   What card 06 asks the coach
 *   --software       Render WebGL in software instead of on this machine's graphics chip
 *
 * How a card is made
 * 1. Captures. The running app is opened in a browser that drives the real GPU, exactly as
 *    scripts/readme-media.mjs does it: a saved state from scripts/fixtures is seeded into
 *    localStorage, the page's clock is set to the afternoon of the day that state stands on (so
 *    the island is in daylight whatever the time is here), the framework's development badge is
 *    hidden and the app's own "3D quality" setting is fixed. A capture is refused if the world
 *    was thinned out while it was taken. Everything is captured at twice the pixel density.
 * 2. Cards. Each card is a small HTML page in the product's own visual language (the cutting
 *    mat, ink outlines, sticker lettering, the three typefaces from node_modules), with the
 *    captures set in frames. It is rendered at 1200 x 800 CSS pixels and twice the density, and
 *    written as a JPEG.
 *
 * Nothing on a card is invented. The numbers on card 11 are read where they live: the test count
 * from Vitest, the catalogue counts from the app's own methodology page, the versions from
 * package.json. The frame rate is the one measured in docs/project-story.md.
 *
 * Card 06 asks the live coach a real question, so it needs an AI key on the server (.env.local).
 * Without one the built-in coach answers and the card says "Built-in" instead of "Live".
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = { cards: [], flags: new Set() };
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) args.cards.push(arg.padStart(2, '0'));
  else if (['software', 'reuse'].includes(arg.slice(2))) args.flags.add(arg.slice(2));
  else args[arg.slice(2)] = process.argv[(i += 1)];
}
const base = args.base ?? 'http://localhost:5173';
const outDir = path.resolve(root, args.out ?? 'docs/showcase');
const workDir = path.resolve(root, args.work ?? 'showcase-out');
const captureDir = path.join(workDir, 'captures');
const cardDir = path.join(workDir, 'cards');
for (const dir of [outDir, captureDir, cardDir]) mkdirSync(dir, { recursive: true });

/** The quality tier every picture is taken on: the one the app picks on integrated graphics. */
const TIER = 'medium';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const CARD = { width: 1200, height: 800, scale: 2 };
const QUESTION =
  args.question ?? 'I cycled 6 km to work and had a veggie lunch today. What did that save?';

// --- Browser ---------------------------------------------------------------------------------

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
  headless: true,
  args: args.flags.has('software')
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

function readFixture(name) {
  const file = path.join(here, 'fixtures', `${name}.json`);
  if (!existsSync(file)) throw new Error(`State fixture not found: ${name}`);
  return Object.entries(JSON.parse(readFileSync(file, 'utf8'))).map(([key, value]) => [
    key,
    typeof value === 'string' ? JSON.parse(value) : value,
  ]);
}

/** A time on the day a fixture stands on, so its numbers hold: by default the afternoon. */
function fixtureClock(name, time = '14:20') {
  const day = readFixture(name).find(([, save]) => save?.state?.clock?.today)?.[1].state.clock
    .today;
  return `${day ?? new Date().toISOString().slice(0, 10)}T${time}:00`;
}

function loadState(name, alwaysDay, patch) {
  return readFixture(name).map(([key, save]) => {
    if (save?.state?.settings) {
      save.state.settings.sound = false;
      save.state.settings.graphics = TIER;
      // The app's own switch: Me > Settings > Sky > "Always day".
      if (alwaysDay) save.state.settings.sky = 'day';
      patch?.(save.state);
    }
    return [key, JSON.stringify(save)];
  });
}

const problems = [];

/**
 * Opens a route and waits until the world has drawn.
 * `state` seeds a saved game and `patch` may change it first. `clock` is a time of day such as
 * "14:20" (the default) on the day the state stands on, or "real": the machine's own time, with
 * the app's "Always day" sky, for a picture that must show how fresh something is.
 */
async function open(route, { state, patch, phone = false, viewport, scale, clock = '14:20' } = {}) {
  const context = await browser.newContext({
    viewport: viewport ?? (phone ? PHONE : DESKTOP),
    deviceScaleFactor: scale ?? (phone ? 3 : 2),
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: 'no-preference',
    colorScheme: 'light',
  });
  // The framework's development badge is not part of the product.
  await context.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important}';
      (document.head ?? document.documentElement).append(style);
    };
    if (document.documentElement) hide();
    else document.addEventListener('readystatechange', hide, { once: true });
  });
  if (state) {
    await context.addInitScript(
      (items) => {
        if (sessionStorage.getItem('__showcase_seeded')) return;
        for (const [key, value] of items) localStorage.setItem(key, value);
        sessionStorage.setItem('__showcase_seeded', '1');
      },
      loadState(state, clock === 'real', patch),
    );
  }
  if (clock !== 'real') {
    await context.addInitScript(
      (iso) => {
        const Real = Date;
        const offset = new Real(iso).getTime() - Real.now();
        class Shifted extends Real {
          constructor(...values) {
            if (values.length === 0) super(Real.now() + offset);
            else super(...values);
          }
          static now() {
            return Real.now() + offset;
          }
        }
        window.Date = Shifted;
      },
      fixtureClock(state ?? 'day200', clock),
    );
  }
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`${route}: ${String(error).slice(0, 200)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`${route}: ${message.text().slice(0, 200)}`);
  });
  await page.goto(new URL(route, base).href, { waitUntil: 'load', timeout: 180_000 });
  await ready(page);
  return page;
}

/** Waits for the world to report that it has drawn and for the fonts, then lets things settle. */
async function ready(page, settle = 1800) {
  await page
    .waitForFunction(
      () => ['ready', 'fallback'].includes(document.documentElement.dataset.world ?? ''),
      null,
      { timeout: 90_000 },
    )
    .catch(() => {});
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}

/** Refuses a picture taken while the world was thinned out (development builds report it). */
async function onTier(page) {
  const stats = await page.evaluate(() => globalThis.__touchgrassWorld?.stats?.() ?? null);
  if (stats && (stats.tier !== TIER || stats.dprScale < 1)) {
    throw new Error(`the world is on ${stats.tier} at ${stats.dprScale} of its resolution`);
  }
}

const captureFile = (name) => path.join(captureDir, `${name}.png`);

/** Writes the viewport, or the part of it inside `clip`, as a capture. */
async function save(page, name, clip) {
  const buffer = await page.screenshot({ type: 'png', ...(clip ? { clip } : {}) });
  await onTier(page);
  writeFileSync(captureFile(name), buffer);
  const { width, height } = await sharp(buffer).metadata();
  console.log(`  ${name}  ${width} x ${height}`);
}

/** The box around one or more elements, grown by `pad` and kept inside the viewport. */
async function around(page, locators, pad = 16) {
  const boxes = [];
  for (const locator of [locators].flat()) {
    const box = await locator.first().boundingBox();
    if (box) boxes.push(box);
  }
  if (boxes.length === 0) throw new Error('nothing to frame');
  const view = page.viewportSize();
  const [top, right, bottom, left] = [pad].flat().length === 4 ? pad : [pad, pad, pad, pad];
  const x0 = Math.max(0, Math.min(...boxes.map((box) => box.x)) - left);
  const y0 = Math.max(0, Math.min(...boxes.map((box) => box.y)) - top);
  const x1 = Math.min(view.width, Math.max(...boxes.map((box) => box.x + box.width)) + right);
  const y1 = Math.min(view.height, Math.max(...boxes.map((box) => box.y + box.height)) + bottom);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The box of an element without its own border: the card's frame draws that edge instead. */
async function inside(locator, inset = 3) {
  const box = await locator.first().boundingBox();
  if (!box) throw new Error('nothing to frame');
  return {
    x: box.x + inset,
    y: box.y + inset,
    width: box.width - inset * 2,
    height: box.height - inset * 2,
  };
}

/** The box of the smallest element that holds both `a` and `b`: a panel, found by what it says. */
async function shared(a, b) {
  const other = await b.first().elementHandle();
  return a.first().evaluate((el, target) => {
    let node = el;
    while (node.parentElement && !node.contains(target)) node = node.parentElement;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, other);
}

/** Scrolls so that the top of an element sits `offset` pixels under the top of the window. */
async function scrollTo(page, locator, offset = 110) {
  await locator.first().evaluate((el, gap) => {
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - gap,
      behavior: 'instant',
    });
  }, offset);
  await page.waitForTimeout(500);
}

/** The world lab (development builds only): the stage alone, filling the window. */
const lab = (query) =>
  `/dev/world?bare=1&${new URLSearchParams({ quality: TIER, ...query }).toString()}`;
/** The lab's own Explore button is not part of the picture. */
const LAB_STYLE = '[data-world-stage] button{display:none!important}';

/** Growth points for a growth value: the inverse of the table in src/game/economy.ts. */
const GROWTH_TABLE = [
  [0, 0],
  [8, 0.03],
  [32, 0.07],
  [150, 0.12],
  [600, 0.35],
  [2000, 0.65],
  [4500, 0.8],
  [9000, 0.9],
  [18000, 0.96],
];
function pointsFor(growth) {
  for (let i = 1; i < GROWTH_TABLE.length; i += 1) {
    const [x0, y0] = GROWTH_TABLE[i - 1];
    const [x1, y1] = GROWTH_TABLE[i];
    if (growth <= y1) return Math.round(x0 + ((growth - y0) / (y1 - y0)) * (x1 - x0));
  }
  return 18000;
}

/**
 * One picture of the island alone, from the lab. The lab takes the tree from its address
 * (`growth`, `species`, `hour`), and the app's game also hands the world its own saved tree:
 * whichever of the two the stage shows, they say the same thing here, because the saved state
 * is given the same growth and species and the page's clock the same hour.
 */
async function tile(name, { state, growth, species, hour, props }, viewport) {
  const whole = Math.floor(hour);
  const time = `${String(whole).padStart(2, '0')}:${String(Math.round((hour - whole) * 60)).padStart(2, '0')}`;
  const query = {
    growth,
    hour,
    ...(species ? { species } : {}),
    ...(props ? { props, age: 200 } : {}),
  };
  const page = await open(lab(query), {
    viewport,
    state,
    clock: time,
    patch: (save) => {
      save.tree.gp = pointsFor(growth);
      save.seen.maxStage = 8;
      if (species) save.profile.species = species;
    },
  });
  await page.addStyleTag({ content: LAB_STYLE });
  // The game's runtime arrives after the first paint on a page like this one.
  await page.waitForFunction(() => '__game' in window, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2600);
  await save(page, name);
}

/** The nine stages the rules engine names, at the growth each starts at (src/game/economy.ts). */
const STAGES = [
  ['Seed', 0.012],
  ['Sprout', 0.03],
  ['Seedling', 0.07],
  ['Sapling', 0.12],
  ['Young tree', 0.35],
  ['Mature tree', 0.65],
  ['Grand tree', 0.8],
  ['Elder', 0.9],
  ['Ancient', 0.96],
];
const SPECIES = ['Oak', 'Cherry', 'Pine'];
const SKIES = [
  ['Dawn', 6.2],
  ['Day', 13],
  ['Golden hour', 18.2],
  ['Night', 23],
];
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// --- Captures --------------------------------------------------------------------------------

/** What is read off the running app for card 11. */
const facts = {};
const factsFile = path.join(workDir, 'facts.json');
if (existsSync(factsFile)) Object.assign(facts, JSON.parse(readFileSync(factsFile, 'utf8')));
const keepFacts = () => writeFileSync(factsFile, JSON.stringify(facts, null, 2));

/** Each take opens one page and writes the captures it `makes`. */
const TAKES = [
  {
    makes: ['island'],
    run: () =>
      tile(
        'island',
        { state: 'day200', growth: 0.767, props: 'all', hour: 15.5 },
        { width: 1000, height: 860 },
      ),
  },
  {
    makes: ['today'],
    async run() {
      const page = await open('/today', { state: 'day200' });
      await save(page, 'today');
    },
  },
  {
    makes: ['explore'],
    async run() {
      const page = await open('/today', {
        state: 'day200',
        viewport: { width: 1420, height: 630 },
      });
      await page.getByRole('button', { name: /Explore the island/i }).click();
      await page.waitForTimeout(3400);
      await save(page, 'explore');
    },
  },
  {
    makes: ['log-sheet', 'log-receipt', 'receipt'],
    async run() {
      const page = await open('/log', { state: 'day200' });
      await page
        .getByRole('button', { name: /^Walk or bike/i })
        .first()
        .click();
      await page.waitForTimeout(900);
      await save(page, 'log-sheet', await inside(page.getByRole('dialog')));
      await page.getByRole('button', { name: 'Stick it on' }).click();
      await page.waitForTimeout(1100);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(400);
      await save(page, 'log-receipt');
      await save(page, 'receipt', await inside(page.locator('[data-sonner-toast]')));
    },
  },
  // The estimate mark on a logged action opens the formula, the comparison, the range and the source.
  {
    makes: ['estimate'],
    async run() {
      const page = await open('/log', { state: 'day200' });
      const mark = page.getByRole('button', { name: 'About this estimate' }).first();
      await mark.click();
      await page.waitForTimeout(800);
      await save(
        page,
        'estimate',
        await inside(page.locator('[data-radix-popper-content-wrapper] > *')),
      );
    },
  },
  {
    makes: ['factors'],
    async run() {
      const page = await open('/methodology', { state: 'day200' });
      // The page prints its own counts: the catalogue's actions, sources and grid regions.
      const glance = await page.getByLabel('This page at a glance').first().innerText();
      for (const [, label, value] of glance.matchAll(/(actions|sources|regions)\s*([\d,]+)/gi)) {
        facts[label.toLowerCase()] = Number(value.replace(/,/g, ''));
      }
      // An action without a credible factor prints "Not quantified" where its estimate would be.
      const table = page.locator('table').first();
      facts.unquantified = await table
        .locator('tbody tr')
        .filter({ has: page.locator('td:nth-child(2)', { hasText: /^\s*not quantified/i }) })
        .count();
      keepFacts();
      await scrollTo(page, table, 96);
      const rows = table.locator('tr');
      await save(page, 'factors', await around(page, [rows.nth(0), rows.nth(4)], [10, 12, 0, 12]));
    },
  },
  {
    makes: ['impact'],
    async run() {
      const page = await open('/impact', {
        state: 'day200',
        viewport: { width: 1280, height: 900 },
      });
      const totals = page.getByText('Avoided so far', { exact: true });
      await scrollTo(page, totals, 124);
      const chart = page.getByText('12 weeks', { exact: true });
      const figure = chart.locator(
        'xpath=ancestor::*[self::section or self::figure or self::article][1]',
      );
      await page.waitForTimeout(1200);
      await save(page, 'impact', await around(page, [totals, figure], [30, 26, 30, 14]));
    },
  },
  // The real clock here: "Live" is only shown for a reading fetched in the last 36 hours.
  {
    makes: ['planet'],
    async run() {
      const page = await open('/impact', { state: 'day200', clock: 'real' });
      await page.getByText('The planet now', { exact: true }).click();
      await page.waitForTimeout(6000);
      const readings = page.getByRole('group', { name: 'The planet right now' });
      await readings.getByRole('link', { name: /World Bank/i }).waitFor({ timeout: 30_000 });
      await save(page, 'planet', await around(page, readings, [14, 26, 28, 14]));
    },
  },
  // The coach's own page, asked a real question. The answer is whatever the coach says.
  {
    makes: ['coach'],
    async run() {
      const page = await open('/coach', {
        state: 'day200',
        viewport: { width: 1280, height: 940 },
      });
      const field = page.getByRole('textbox', { name: /Message Moss/i });
      await field.waitFor({ timeout: 20_000 });
      // The notice about where a message goes is read and put away, as a person would.
      const gotIt = page.getByRole('button', { name: 'Got it', exact: true });
      if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
      await page.waitForTimeout(500);
      await field.fill(QUESTION);
      await page.getByRole('button', { name: 'Send' }).click();
      // The answer is streamed: it is done when the note under an answer has been printed.
      await page
        .getByText(/AI-generated|Built-in answer/i)
        .first()
        .waitFor({ timeout: 60_000 });
      await page.waitForTimeout(2500);
      facts.coach = (await page.getByText(/^live$/i).count()) > 0 ? 'live' : 'built-in';
      keepFacts();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(600);
      await save(page, 'coach');
    },
  },
  {
    makes: ['quests'],
    async run() {
      const page = await open('/quests', { state: 'day200' });
      await save(page, 'quests');
    },
  },
  {
    makes: ['passport', 'badges'],
    async run() {
      const page = await open('/me', { state: 'day200', viewport: { width: 1280, height: 900 } });
      const passport = await shared(
        page.getByText('Tree passport', { exact: false }),
        page.getByText(/Each ring on the disc/i),
      );
      await save(page, 'passport', {
        x: passport.x + 3,
        y: passport.y + 3,
        width: passport.width - 6,
        height: passport.height - 6,
      });
      const first = page.getByText('Trailblazer', { exact: true });
      await scrollTo(page, first, 260);
      const last = page.getByText('Well Rounded', { exact: true });
      const grid = await shared(first, last);
      const end = await last.first().boundingBox();
      await save(page, 'badges', {
        x: grid.x - 10,
        y: grid.y - 58,
        width: grid.width + 20,
        height: end.y + end.height + 34 - (grid.y - 58),
      });
    },
  },
  ...STAGES.map(([name, growth]) => ({
    makes: [`stage-${slug(name)}`],
    run: () =>
      tile(`stage-${slug(name)}`, { state: 'day1', growth, hour: 13 }, { width: 420, height: 420 }),
  })),
  ...SPECIES.map((name) => ({
    makes: [`species-${slug(name)}`],
    run: () =>
      tile(
        `species-${slug(name)}`,
        { state: 'day1', species: slug(name), growth: 0.7, hour: 14 },
        { width: 460, height: 460 },
      ),
  })),
  ...SKIES.map(([name, hour]) => ({
    makes: [`sky-${slug(name)}`],
    run: () =>
      tile(
        `sky-${slug(name)}`,
        { state: 'day200', growth: 0.767, props: 'all', hour },
        { width: 460, height: 460 },
      ),
  })),
  ...[
    ['/today', 'phone-today'],
    ['/log', 'phone-log'],
    ['/impact', 'phone-impact'],
  ].map(([route, name]) => ({
    makes: [name],
    async run() {
      const page = await open(route, { state: 'day200', phone: true });
      await save(page, name);
    },
  })),
];

/** A take can be refused on a busy machine (see `onTier`): try it again, a few times. */
async function take(entry) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await entry.run();
      return;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`  take ${attempt} failed (${String(error.message).slice(0, 160)}): again`);
    } finally {
      for (const context of browser.contexts()) await context.close();
    }
  }
}

// --- The numbers on card 11 -------------------------------------------------------------------

function countTests() {
  if (args.tests) return Number(args.tests);
  if (args.flags.has('reuse') && facts.tests) return facts.tests;
  console.log('  counting the unit tests (npx vitest list)');
  const listed = spawnSync('npx', ['vitest', 'list'], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = (listed.stdout ?? '').split('\n').filter((line) => line.includes(' > '));
  if (lines.length === 0) throw new Error('Vitest listed no tests: pass --tests <n>');
  facts.testFiles = new Set(lines.map((line) => line.split(' > ')[0])).size;
  return lines.length;
}

function versions() {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const of = (name) => lock.packages?.[`node_modules/${name}`]?.version ?? '';
  const short = (name, parts = 1) => of(name).split('.').slice(0, parts).join('.');
  return {
    next: short('next'),
    react: short('react'),
    typescript: short('typescript', 2),
    three: `r${of('three').split('.')[1] ?? ''}`,
    tailwind: short('tailwindcss'),
    zustand: short('zustand'),
    vitest: short('vitest'),
  };
}

// --- Card pages ------------------------------------------------------------------------------

const font = (pkg, file) =>
  readFileSync(
    path.join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file),
  ).toString('base64');
const FONTS = `
@font-face{font-family:'Tilt Warp';font-weight:400;src:url(data:font/woff2;base64,${font('tilt-warp', 'tilt-warp-latin-full-normal.woff2')}) format('woff2')}
@font-face{font-family:'Space Grotesk';font-weight:300 700;src:url(data:font/woff2;base64,${font('space-grotesk', 'space-grotesk-latin-wght-normal.woff2')}) format('woff2')}
@font-face{font-family:'Martian Mono';font-weight:100 800;src:url(data:font/woff2;base64,${font('martian-mono', 'martian-mono-latin-wght-normal.woff2')}) format('woff2')}
`;

/** The repository's address, from the one place the product keeps it. */
const REPO = (readFileSync(path.join(root, 'src', 'lib', 'brand.ts'), 'utf8').match(
  /repoUrl:\s*'https?:\/\/([^']+)'/,
) ?? [])[1];

/**
 * The product's tokens and paper recipes (src/styles/index.css), for a page of 1200 x 800.
 * Every card has the same bones: the mark and a tag on top, one line of sticker lettering, a
 * column of text on the left (58 to 350), the captures on the right (384 to 1144), the
 * repository's address at the foot.
 */
const STYLE = `
${FONTS}
:root{--ink:#18181b;--ink-2:#3f3f46;--ink-3:#52525b;--white:#fff;--mat:#f0fdf4;--mat-deep:#dcfce7;
--mat-line:#d3f5df;--mat-major:#bdeecd;--paper:#fffbeb;--line:#e4e4e7;--green:#4ade80;--green-deep:#166534;
--yellow:#facc15;--yellow-tint:#fef9c3;--pink:#f472b6;--pink-deep:#be185d;--pink-tint:#fce7f3;--blue:#60a5fa;
--blue-tint:#dbeafe;--violet:#9974f8;--violet-tint:#ede9fe;--orange:#fb923c;--orange-tint:#ffedd5;
--teal:#2dd4bf;--teal-tint:#ccfbf1;--tomato:#ff6b4a;--kraft:#e7c9a0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:800px;overflow:hidden}
body{position:relative;font-family:'Space Grotesk',sans-serif;font-weight:500;color:var(--ink);
-webkit-font-smoothing:antialiased;background-color:var(--mat);
background-image:linear-gradient(var(--mat-major) 1.5px,#0000 1.5px),linear-gradient(90deg,var(--mat-major) 1.5px,#0000 1.5px),
linear-gradient(var(--mat-line) 1px,#0000 1px),linear-gradient(90deg,var(--mat-line) 1px,#0000 1px);
background-size:80px 80px,80px 80px,16px 16px,16px 16px;background-position:-1px -1px}
.abs{position:absolute}
.mark{position:absolute;left:56px;top:38px;display:flex;align-items:center;gap:11px;font-size:21px;font-weight:700;letter-spacing:-.01em}
.mark .tile{display:grid;place-items:center;width:36px;height:36px;rotate:-4deg;border:3px solid var(--ink);border-radius:10px;
background:var(--green);box-shadow:2px 2px 0 var(--ink)}
.tag{display:inline-block;font-family:'Martian Mono',monospace;font-size:11.5px;font-weight:600;letter-spacing:.08em;line-height:1;
text-transform:uppercase;padding:6px 9px 5px;border:2px solid var(--ink);border-radius:6px;background:var(--yellow);white-space:nowrap}
.kicker{position:absolute;right:56px;top:44px}
.lettering{--fill:var(--green);--m:.1em;position:relative;display:inline-block;isolation:isolate;font-family:'Tilt Warp',sans-serif;
font-weight:400;letter-spacing:.035em;color:var(--fill);-webkit-text-stroke:.045em var(--ink);paint-order:stroke fill;white-space:nowrap}
.lettering::before,.lettering::after{content:attr(data-text);position:absolute;inset:0;z-index:-1;color:var(--white);
-webkit-text-stroke:calc(var(--m)*2) var(--white);paint-order:stroke fill}
.lettering::after{z-index:-2;color:var(--ink);-webkit-text-stroke:calc(var(--m)*2 + 3px) var(--ink);filter:drop-shadow(.05em .05em 0 var(--ink))}
h1{position:absolute;left:58px;top:98px;font-size:74px;line-height:1.1;font-weight:400}
h1 .lettering{display:block;width:max-content}
.col{position:absolute;left:58px;top:244px;width:292px;display:flex;flex-direction:column;gap:26px}
.sub{font-size:20px;line-height:1.42;font-weight:500;color:var(--ink-2);text-wrap:pretty}
.facts{list-style:none;display:grid;gap:13px;font-size:15.5px;line-height:1.32;font-weight:600}
.facts li{display:flex;gap:10px;align-items:flex-start}
.facts li::before{content:'';flex:none;width:16px;height:16px;margin-top:2px;border:2.5px solid var(--ink);border-radius:50%;
background:var(--dot,var(--green));box-shadow:1.5px 1.5px 0 var(--ink)}
.frame{position:absolute;border:3px solid var(--ink);border-radius:14px;background:var(--white);overflow:hidden;
box-shadow:7px 7px 0 var(--ink),0 30px 46px -14px rgb(24 24 27 / .34)}
.frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 0}
.frame.soft{box-shadow:0 20px 34px -14px rgb(24 24 27 / .4)}
.bare{position:absolute;filter:drop-shadow(0 18px 20px rgb(24 24 27 / .3))}
.bare img{display:block;width:100%}
.tape{position:absolute;width:104px;height:28px;rotate:-4deg;background:color-mix(in srgb,var(--tape,var(--pink)) 86%,transparent);
border-block:2px solid var(--ink);z-index:5;
clip-path:polygon(0 0,100% 0,calc(100% - 4px) 12.5%,100% 25%,calc(100% - 4px) 37.5%,100% 50%,calc(100% - 4px) 62.5%,100% 75%,calc(100% - 4px) 87.5%,100% 100%,0 100%,4px 87.5%,0 75%,4px 62.5%,0 50%,4px 37.5%,0 25%,4px 12.5%)}
.stamp{position:absolute;z-index:6;padding:12px 15px 11px;font-family:'Martian Mono',monospace;font-size:13px;font-weight:700;letter-spacing:.12em;
text-transform:uppercase;line-height:1;white-space:nowrap;color:var(--stamp,var(--pink-deep));border:3px solid currentColor;border-radius:8px;
outline:1.5px dashed currentColor;outline-offset:-7px;background:rgb(255 255 255 / .9);rotate:-6deg;
-webkit-mask-image:radial-gradient(circle at 30% 40%,#0000 0 1.1px,#000 1.5px),radial-gradient(circle at 70% 65%,#0000 0 .9px,#000 1.3px);
-webkit-mask-size:13px 13px,17px 17px;-webkit-mask-composite:source-in}
.note{position:absolute;padding:14px 16px 15px;border:3px solid var(--ink);border-radius:4px;background:var(--paper);box-shadow:5px 5px 0 var(--ink);
font-size:15.5px;line-height:1.36;font-weight:600}
.slug{display:block;font-family:'Martian Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
color:var(--ink-3);margin-bottom:7px}
.foot{position:absolute;left:58px;bottom:22px;font-family:'Martian Mono',monospace;font-size:10.5px;font-weight:500;letter-spacing:.07em;
color:var(--ink-3)}
`;

/** Shrinks a headline until its one line fits the card. */
const FIT = `<script>document.fonts.ready.then(()=>{for(const h of document.querySelectorAll('h1[data-fit]')){
let size=parseFloat(getComputedStyle(h).fontSize);
while(h.firstElementChild.getBoundingClientRect().width>Number(h.dataset.fit)&&size>40){size-=1;h.style.fontSize=size+'px'}}
document.documentElement.dataset.fitted='1'})</script>`;

const LEAF = `<svg viewBox="0 0 24 24" width="21" height="21"><path d="M5 19c-1.5-7 2.5-13.5 14.5-14.5C20.5 15 14 20.500 5 19z" fill="#fff" stroke="#18181b" stroke-width="2.25" stroke-linejoin="round"/><path d="M4 20.500C7.5 15 11 11.500 15.500 9" fill="none" stroke="#18181b" stroke-width="2.25" stroke-linecap="round"/></svg>`;
const mark = `<div class="mark"><span class="tile">${LEAF}</span>Touch Grass</div>`;
const foot = REPO ? `<span class="foot">${REPO}</span>` : '';
const esc = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const img = (name, style) =>
  `<img src="${pathToFileURL(captureFile(name)).href}" alt=""${style ? ` style="${style}"` : ''}>`;
const box = (x, y, w, h) => `left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ''}`;
/** The top of a card: the mark, a tag and one line of sticker lettering. */
const head = (tag, title, fill = 'green') => `${mark}<span class="tag kicker">${esc(tag)}</span>
  <h1 data-fit="1086"><span class="lettering" style="--fill:var(--${fill})" data-text="${esc(title)}">${esc(title)}</span></h1>${foot}`;
/** The text column: one supporting line and a few facts. */
const column = (sub, items, dot = 'green') => `<div class="col"><p class="sub">${sub}</p>
  <ul class="facts" style="--dot:var(--${dot})">${items.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;
const frame = (name, x, y, w, h, extra = '') =>
  `<div class="frame" style="${box(x, y, w, h)}${extra}">${img(name)}</div>`;

const number = (value) => Number(value).toLocaleString('en-US');

/**
 * The eleven cards. `caption` is the line for the submission form; `needs` names the captures
 * a card is built from; `seven` marks the cards to use where a form allows only seven.
 */
const CARDS = [
  {
    id: '01',
    file: '01-cover',
    seven: true,
    caption:
      'Touch Grass: log small real-world climate actions, get an honest CO2e estimate, and grow a living 3D island.',
    needs: ['island'],
    html: () => {
      const teeth = Array.from(
        { length: 50 },
        (_, i) => `L28 ${i * 16 + 8}L14 ${i * 16 + 16}`,
      ).join('');
      return `
      <div class="abs" style="left:520px;top:0;width:680px;height:800px;overflow:hidden">${img('island', 'width:100%;height:100%;object-fit:cover;object-position:50% 55%')}</div>
      <svg class="abs" style="left:506px;top:0" width="30" height="800" viewBox="0 0 30 800">
        <path d="M0 0H14${teeth}H0Z" fill="#f0fdf4"/>
        <path d="M14 0${teeth}" fill="none" stroke="#18181b" stroke-width="4"/>
      </svg>
      ${mark}
      <span class="abs" style="left:58px;top:146px;rotate:-2.5deg;font-size:17px;font-weight:700;padding:7px 15px;border:3px solid var(--ink);border-radius:999px;background:var(--pink);box-shadow:3px 3px 0 var(--ink)">No doomscrolling allowed.</span>
      <h1 style="top:208px;font-size:128px"><span class="lettering" data-text="Touch">Touch</span><span class="lettering" style="margin-top:-.02em" data-text="Grass">Grass</span></h1>
      <p class="abs" style="left:58px;top:508px;width:420px;font-size:31px;line-height:1.16;font-weight:700;letter-spacing:-.015em">Grow a living world with small real actions.</p>
      <p class="sub abs" style="left:58px;top:614px;width:410px;font-size:19.5px">Log what you did. Get an honest CO<sub style="font-size:.7em">2</sub>e estimate. Watch your island grow.</p>
      <div class="abs" style="left:58px;top:706px;display:flex;gap:9px">
        <span class="tag" style="background:var(--white)">No account</span>
        <span class="tag" style="background:var(--white)">Local-first</span>
        <span class="tag" style="background:var(--white)">Real-time 3D</span>
      </div>${foot}`;
    },
  },
  {
    id: '02',
    file: '02-living-world',
    seven: true,
    caption:
      'The Today page: a living 3D island, generated in code, that follows your clock and grows with every action you log.',
    needs: ['today'],
    html: () => `
      ${head('The world', 'A world your habits grow')}
      ${column('One live 3D scene, generated entirely in code. No model files, no video.', [
        'It keeps your own hours: dawn, day, golden hour, night',
        'Every prop on the island was earned by a real action',
        'Drag to turn it. Tap anything to see what earned it',
      ])}
      ${frame('today', 384, 252, 760, 475)}
      <i class="tape" style="left:712px;top:238px"></i>`,
  },
  {
    id: '03',
    file: '03-log-in-seconds',
    seven: true,
    caption:
      'Logging takes seconds: peel a sticker, pick an amount, see the estimate before you commit, and get a receipt with Undo.',
    needs: ['log-sheet', 'log-receipt', 'receipt'],
    html: () => `
      ${head('Logging', 'Log it in seconds', 'violet')}
      ${column(
        'Peel a sticker, pick an amount, stick it on. The estimate shows before you commit.',
        [
          `${number(facts.actions ?? 51)} catalogued actions in seven kinds`,
          'Or say it in your own words',
        ],
        'violet',
      )}
      ${frame('log-receipt', 384, 242, 760, 475)}
      ${frame('log-sheet', 296, 440, 272, 0, 'rotate:-3deg;border-radius:22px;')}
      ${frame('receipt', 736, 652, 420, 0, 'rotate:1.5deg;border-radius:12px;')}
      <i class="tape" style="left:452px;top:414px;--tape:var(--yellow);rotate:-7deg"></i>`,
  },
  {
    id: '04',
    file: '04-honest-numbers',
    seven: true,
    caption:
      'Honest numbers: every figure is an estimate that opens its formula, its comparison, a likely range and its source.',
    needs: ['estimate', 'factors'],
    html: () => `
      ${head('Honest numbers', 'Every number shows its working', 'yellow')}
      ${column(
        'An estimate, marked as one: the formula, what it is compared with, a likely range and the source.',
        [
          `${number(facts.sources ?? 55)} sources behind ${number(facts.actions ?? 51)} actions, on one public page`,
          facts.unquantified
            ? `${number(facts.unquantified)} actions have no credible figure, so they print none`
            : 'No number where none is credible',
          'Avoided, never “offset”',
        ],
        'yellow',
      )}
      ${frame('factors', 384, 242, 760, 0)}
      ${frame('estimate', 838, 388, 312, 0, 'rotate:2deg;border-radius:5px;')}
      <i class="tape" style="left:940px;top:374px;--tape:var(--yellow);rotate:5deg"></i>`,
  },
  {
    id: '05',
    file: '05-impact-and-planet',
    seven: true,
    caption:
      'Impact: your own totals by category and week, next to live planet readings from NASA, NOAA and the World Bank.',
    needs: ['impact', 'planet'],
    html: () => `
      ${head('Impact', "Your impact, next to the planet's", 'blue')}
      ${column(
        'Your totals by category and week, beside readings from NASA, NOAA and the World Bank.',
        [
          'Fetched by our own server, never by your browser',
          '“Live” only when a reading is under 36 hours old',
        ],
        'blue',
      )}
      ${frame('impact', 384, 242, 760, 500)}
      ${frame('planet', 588, 508, 570, 0, 'rotate:-1.5deg;')}
      <i class="tape" style="left:820px;top:494px;--tape:var(--blue)"></i>`,
  },
  {
    id: '06',
    file: '06-live-coach',
    seven: true,
    caption:
      'Moss, the coach, answering a typed question live, with action chips you can log in one tap. The AI key never leaves the server.',
    needs: ['coach'],
    html: () => `
      ${head('The coach', 'Ask Moss anything')}
      ${column(
        facts.coach === 'built-in'
          ? 'A real question, answered by the built-in coach, with chips that log the action in one tap.'
          : 'A real question, answered live by a language model, with chips that log the action in one tap.',
        [
          'The key stays on our server, never in the browser',
          'Moss suggests. Only you can log',
          'No key? A built-in coach answers, and says so',
        ],
      )}
      ${frame('coach', 444, 240, 700, 514)}
      <span class="stamp" style="left:66px;top:640px;rotate:-5deg;--stamp:var(--green-deep)">${facts.coach === 'built-in' ? 'Built-in answer' : 'Live answer · not staged'}</span>`,
  },
  {
    id: '07',
    file: '07-the-game',
    caption:
      'The game: daily and weekly quests that track themselves, 33 badges, and a tree passport with one growth ring per day.',
    needs: ['quests', 'passport', 'badges'],
    html: () => `
      ${head('The game', 'Kind rules, real progress', 'pink')}
      ${column(
        'Quests that track themselves, badges stamped into a passport, a ring for every day you show up.',
        ['XP, growth and kilograms never convert', 'Miss a day and it rains. The tree never dies'],
        'pink',
      )}
      ${frame('quests', 384, 242, 760, 475)}
      ${frame('passport', 296, 572, 460, 0, 'rotate:-2.5deg;border-radius:5px;')}
      ${frame('badges', 782, 532, 376, 0, 'rotate:2deg;')}`,
  },
  {
    id: '08',
    file: '08-it-grows',
    caption:
      'It grows: nine growth stages from seed to ancient, three species, and a sky that follows your day from dawn to night.',
    needs: [
      ...STAGES.map(([name]) => `stage-${slug(name)}`),
      ...SPECIES.map((name) => `species-${slug(name)}`),
      ...SKIES.map(([name]) => `sky-${slug(name)}`),
    ],
    html: () => {
      const cell = (name, label, x, y, size) =>
        `<div class="frame soft" style="${box(x, y, size, size)}border-radius:10px;border-width:2.5px">${img(name)}</div>
         <span class="slug abs" style="left:${x - 10}px;top:${y + size + 10}px;width:${size + 20}px;text-align:center;color:var(--ink)">${esc(label)}</span>`;
      const stages = STAGES.map(([name], i) =>
        cell(`stage-${slug(name)}`, name, 56 + i * 122, 330, 112),
      );
      const row = [
        ...SPECIES.map((name) => [`species-${slug(name)}`, name]),
        ...SKIES.map(([name]) => [`sky-${slug(name)}`, name]),
      ].map(([name, label], i) => cell(name, label, 56 + i * 153 + (i > 2 ? 25 : 0), 552, 144));
      return `
      ${head('Growth', 'From seed to ancient')}
      <p class="sub abs" style="left:58px;top:206px;width:1000px;font-size:22px">Nine stages, three species, and a sky that keeps your own hours. Growth is never taken away.</p>
      <span class="slug abs" style="left:58px;top:302px">Nine stages · one seed always grows the same tree</span>
      ${stages.join('')}
      <span class="slug abs" style="left:58px;top:524px">Three species</span>
      <span class="slug abs" style="left:540px;top:524px">One island, four skies · it follows your clock</span>
      ${row.join('')}`;
    },
  },
  {
    id: '09',
    file: '09-explore-mode',
    caption:
      'Explore mode: the island full screen, with labelled landmarks, camera controls and a photo button.',
    needs: ['explore'],
    html: () => `
      ${head('Explore mode', 'Step inside the island', 'teal')}
      <p class="sub abs" style="left:58px;top:206px;width:1000px;font-size:22px">Full screen, with landmarks that lead to every part of the app, and a photo button.</p>
      ${frame('explore', 56, 258, 1088, 482)}`,
  },
  {
    id: '10',
    file: '10-on-a-phone',
    caption:
      'On a phone: the same island, the sticker sheet and your impact, with a thumb-reach tab bar. Nothing to install.',
    needs: ['phone-today', 'phone-log', 'phone-impact'],
    html: () => {
      const phone = (name, x, y, tilt) =>
        `<div class="abs" style="${box(x, y, 244, 517)}rotate:${tilt}deg;border-radius:34px;background:var(--ink);padding:8px;box-shadow:0 30px 44px -18px rgb(24 24 27 / .5)">
          <div style="width:100%;height:100%;border-radius:27px;overflow:hidden;background:#fff">${img(name, 'display:block;width:100%')}</div>
        </div>`;
      return `
      ${head('On a phone', 'Made for your pocket', 'orange')}
      ${column(
        'The whole app at phone width, with the tab bar in thumb reach.',
        ['Nothing to install', 'Checked at ten widths, from 320 px up'],
        'orange',
      )}
      ${phone('phone-today', 392, 240, -2)}
      ${phone('phone-log', 654, 226, 0)}
      ${phone('phone-impact', 916, 240, 2)}`;
    },
  },
  {
    id: '11',
    file: '11-how-it-is-built',
    seven: true,
    caption:
      'How it is built: Next.js, React, TypeScript and three.js; a pure rules engine under test; local-first, with no account and no database.',
    needs: [],
    html: () => {
      const v = versions();
      const stat = (value, label, x, w, hue) =>
        `<div class="note" style="${box(x, 286, w, 136)}background:var(--white);border-radius:12px;padding:15px 18px;overflow:hidden">
          <span class="slug" style="margin-bottom:8px;min-height:2.5em;line-height:1.25">${label}</span>
          <span style="display:block;font-family:'Tilt Warp';font-size:54px;line-height:1;font-weight:400">${value}</span>
          <i style="position:absolute;left:0;right:0;bottom:0;height:12px;border-top:3px solid var(--ink);background:var(--${hue})"></i>
        </div>`;
      const chip = (text) =>
        `<span class="tag" style="background:var(--white);font-size:12px;padding:8px 10px 7px">${esc(text)}</span>`;
      const step = (n, text) =>
        `<li style="display:flex;gap:11px"><span style="flex:none;width:22px;height:22px;border:2.5px solid var(--ink);border-radius:50%;background:var(--yellow);font-family:'Martian Mono';font-size:11px;font-weight:700;display:grid;place-items:center">${n}</span><span>${text}</span></li>`;
      return `
      ${head('Under the hood', 'Built to hold up')}
      <p class="sub abs" style="left:58px;top:206px;width:1020px;font-size:22px">A pure TypeScript rules engine, a procedural 3D world, and a server that only relays.</p>
      ${stat(number(facts.tests ?? 0), 'Automated unit tests', 56, 258, 'green')}
      ${stat('58–60', 'Frames a second on integrated graphics', 334, 290, 'yellow')}
      ${stat('0', 'Accounts · databases · trackers', 644, 238, 'pink')}
      ${stat(number(facts.sources ?? 55), `Sources behind ${number(facts.actions ?? 51)} actions`, 902, 242, 'blue')}
      <div class="note" style="${box(56, 462, 528)}padding:20px 22px 22px">
        <span class="slug" style="margin-bottom:14px">One log, start to finish</span>
        <ol style="list-style:none;display:grid;gap:15px;font-size:16.5px;line-height:1.34">
          ${step(1, '<b>You tap a sticker</b>, or confirm a chip from the coach')}
          ${step(2, '<b>transact(state, now, op)</b>: one pure function settles the day, scores the act, reconciles quests and badges')}
          ${step(3, '<b>The state</b> is saved in your browser, and nowhere else')}
          ${step(4, '<b>The events</b> become pulses: leaves burst, the tree takes a growth step')}
        </ol>
      </div>
      <div class="abs" style="left:620px;top:462px;width:524px">
        <span class="slug" style="margin-bottom:10px">The stack</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${[`Next.js ${v.next}`, `React ${v.react}`, `TypeScript ${v.typescript}, strict`, `three.js ${v.three}`, 'React Three Fiber', `Tailwind CSS ${v.tailwind}`, `Zustand ${v.zustand}`, `Vitest ${v.vitest}`, 'Playwright'].map(chip).join('')}
        </div>
        <span class="slug" style="margin:22px 0 10px">Also true</span>
        <ul class="facts" style="gap:10px;font-size:15px">
          <li>Local-first: it keeps working offline, with no account</li>
          <li>The island is code: no model files, about 40 draw calls</li>
          <li>The AI key lives on the server. Without one, a built-in coach answers</li>
          <li>Planet readings from NASA, NOAA and the World Bank</li>
        </ul>
      </div>`;
    },
  },
];

// --- Run -------------------------------------------------------------------------------------

if (CARDS.filter((card) => card.seven).length !== 7) throw new Error('mark exactly seven cards');
const wanted = args.cards.length > 0 ? CARDS.filter((card) => args.cards.includes(card.id)) : CARDS;
if (wanted.length === 0) {
  console.error(`No such card. Cards: ${CARDS.map((card) => card.id).join(' ')}`);
  await browser.close();
  process.exit(2);
}

const written = [];
try {
  // 1. Captures.
  const needed = new Set(wanted.flatMap((card) => card.needs));
  console.log('captures');
  for (const entry of TAKES) {
    if (!entry.makes.some((name) => needed.has(name))) continue;
    if (args.flags.has('reuse') && entry.makes.every((name) => existsSync(captureFile(name))))
      continue;
    await take(entry);
  }
  if (wanted.some((card) => card.id === '11')) {
    facts.tests = countTests();
    keepFacts();
  }

  // 2. Cards.
  console.log('cards');
  const context = await browser.newContext({
    viewport: { width: CARD.width, height: CARD.height },
    deviceScaleFactor: CARD.scale,
  });
  const page = await context.newPage();
  for (const card of wanted) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${card.file}</title><style>${STYLE}</style></head><body>${card.html()}${FIT}</body></html>`;
    const file = path.join(cardDir, `${card.file}.html`);
    writeFileSync(file, html);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.fitted === '1');
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode().catch(() => {}))),
    );
    await page.waitForTimeout(250);
    const png = await page.screenshot({ type: 'png' });
    const target = path.join(outDir, `${card.file}.jpg`);
    await sharp(png)
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toFile(target);
    const { width, height } = await sharp(target).metadata();
    const kb = statSync(target).size / 1024;
    written.push(card.file);
    console.log(`  ${card.file}.jpg  ${width} x ${height}  ${kb.toFixed(0)} kB`);
    if (kb > 3 * 1024) console.warn('    over 3 MB');
  }
  await context.close();
} finally {
  await browser.close();
}

// 3. The list for the submission form.
const size = (card) => {
  const file = path.join(outDir, `${card.file}.jpg`);
  return existsSync(file) ? `${(statSync(file).size / 1024).toFixed(0)} kB` : 'not made yet';
};
const readme = `# Showcase images

Eleven gallery images for a submission page. Each is 2400 x 1600 pixels (3:2), a JPEG under 3 MB.
Every capture on them is the running app; nothing is drawn or staged.

| File | Caption to paste | Size |
| --- | --- | --- |
${CARDS.map((card) => `| [\`${card.file}.jpg\`](${card.file}.jpg) | ${card.caption} | ${size(card)} |`).join('\n')}

## When a form allows only seven

Use these, in this order: ${CARDS.filter((card) => card.seven)
  .map((card) => `\`${card.file}.jpg\``)
  .join(', ')}.

They tell the whole story on their own: what it is, the world, the log, the honest numbers, the
planet, the live coach, and how it is built. The four left out (${CARDS.filter(
  (card) => !card.seven,
)
  .map((card) => `\`${card.file}.jpg\``)
  .join(', ')}) add depth where there is room.

## Making them again

\`\`\`bash
npm run dev                          # the app on http://localhost:5173, in another terminal
node scripts/showcase-images.mjs     # all eleven, about eight minutes
node scripts/showcase-images.mjs 06  # one card
\`\`\`

The script opens the running app in a browser on the real GPU, seeds the saved state
\`scripts/fixtures/day200.json\`, sets the page's clock to that day's afternoon so the island is in
daylight, and renders each card at twice the pixel density. Card 06 asks the coach a real question,
so it needs an AI key in \`.env.local\`; without one the built-in coach answers and the card says so.
The product video has its own notes in [video.md](video.md).
`;
writeFileSync(path.join(outDir, 'README.md'), readme);

if (problems.length > 0) {
  console.warn(`\n${problems.length} message(s) from the pages while capturing:`);
  for (const line of [...new Set(problems)].slice(0, 20)) console.warn(`  ${line}`);
}
console.log(`\n${written.length} card(s) in ${path.relative(root, outDir)}`);
