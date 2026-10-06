#!/usr/bin/env node
/**
 * Captures the pictures the README shows (docs/readme/) from the running app.
 *
 *   node scripts/readme-media.mjs [task ...] [options]
 *
 * Tasks (default: all of them)
 *   timelapse   the landing page's own time-lapse, scrolled from seed to grand tree (animated)
 *   turn        the grown island turned once around by dragging it (animated)
 *   stills      the desktop screenshots of the gallery and the tour
 *   phone       the phone-width screenshots
 *   stages      one picture per growth stage, from the world lab
 *   skies       the same island at dawn, by day, at golden hour and at night
 *   species     oak, cherry and pine
 *
 * Options
 *   --base <url>    Server origin (default http://localhost:5173). The world lab only exists
 *                   in a development build, so `turn`, `stages`, `skies` and `species` need one.
 *   --out <dir>     Output folder (default docs/readme)
 *   --software      Render WebGL in software instead of on this machine's graphics chip
 *   --keep-frames   Keep the frames of the animated captures as PNG files next to them
 *
 * How the pictures are made
 * - The browser drives the real GPU (the same flags as scripts/world-perf.mjs), so the world
 *   looks as it does for a person.
 * - The island follows the clock of the machine it runs on. So that a capture made at night
 *   still shows daylight, the page's clock is set to the afternoon of the day the saved states
 *   in scripts/fixtures were built for. Nothing in the app is changed.
 * - Saved states are seeded into localStorage exactly as scripts/shot.mjs does it.
 * - The app's own "3D quality" setting is fixed at Medium, the tier it picks by itself on
 *   integrated graphics. Left on Auto, a machine that is busy with other work thins the scene
 *   in the middle of a take. A picture is refused if the world was not on that tier.
 * - Images are written as WebP with sharp, which Next.js already installs. The animated
 *   captures are encoded by Pillow when Python has it (`pip install pillow`), because it can
 *   place key frames; without it sharp is used, and slow changes of the sky may leave blocks.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const TASKS = ['timelapse', 'turn', 'stills', 'phone', 'stages', 'skies', 'species'];

const args = { tasks: [], flags: new Set() };
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) args.tasks.push(arg);
  else if (['software', 'keep-frames'].includes(arg.slice(2))) args.flags.add(arg.slice(2));
  else args[arg.slice(2)] = process.argv[(i += 1)];
}
const unknown = args.tasks.filter((task) => !TASKS.includes(task));
if (unknown.length > 0) {
  console.error(`Unknown task: ${unknown.join(', ')}. Tasks: ${TASKS.join(', ')}`);
  process.exit(2);
}
const tasks = args.tasks.length > 0 ? args.tasks : TASKS;
const base = args.base ?? 'http://localhost:5173';
const outDir = path.resolve(args.out ?? path.join(here, '..', 'docs', 'readme'));
mkdirSync(outDir, { recursive: true });

/** The fixtures in scripts/fixtures stand on this day; the afternoon gives the island daylight. */
const CLOCK = '2026-10-06T14:20:00';
/** Desktop pictures are taken at 1280 x 800 and one and a half times the pixel density. */
const DESKTOP = { width: 1280, height: 800 };
const DESKTOP_SCALE = 1.5;
const PHONE = { width: 390, height: 844 };
/** The quality tier every picture is taken on (Me > Settings > 3D quality). */
const TIER = 'medium';

// --- Browser ---------------------------------------------------------------------------------

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
  headless: true,
  args: args.flags.has('software')
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

function loadState(name, alwaysDay) {
  const file = path.join(here, 'fixtures', `${name}.json`);
  if (!existsSync(file)) throw new Error(`State fixture not found: ${name}`);
  return Object.entries(JSON.parse(readFileSync(file, 'utf8'))).map(([key, value]) => {
    const save = typeof value === 'string' ? JSON.parse(value) : value;
    if (save?.state?.settings) {
      // A capture has no use for sound.
      save.state.settings.sound = false;
      save.state.settings.graphics = TIER;
      // The app's own switch: Me > Settings > Sky > "Always day".
      if (alwaysDay) save.state.settings.sky = 'day';
    }
    return [key, JSON.stringify(save)];
  });
}

/**
 * Opens a route and waits until the world has drawn.
 * `state` seeds a saved game, `phone` emulates a touch screen at twice the pixel density,
 * `clock` (on by default) sets the page's clock to the afternoon. With `clock: false` the
 * page keeps the real time and a seeded state gets the app's "Always day" sky instead:
 * that is for pictures that must show how fresh something is.
 * Without `state` the page is opened as a first-time visitor: nobody has planted a tree.
 */
async function open(route, { state, phone = false, viewport, clock = true, scale } = {}) {
  const context = await browser.newContext({
    viewport: viewport ?? (phone ? PHONE : DESKTOP),
    deviceScaleFactor: scale ?? (phone ? 2 : DESKTOP_SCALE),
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: 'no-preference',
    colorScheme: 'light',
  });
  if (state) {
    await context.addInitScript(
      (items) => {
        if (sessionStorage.getItem('__readme_seeded')) return;
        for (const [key, value] of items) localStorage.setItem(key, value);
        sessionStorage.setItem('__readme_seeded', '1');
      },
      loadState(state, !clock),
    );
  }
  if (clock) {
    await context.addInitScript((iso) => {
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
    }, CLOCK);
  }
  const page = await context.newPage();
  page.on('pageerror', (error) =>
    console.warn(`  page error on ${route}: ${String(error).slice(0, 200)}`),
  );
  if (!state && !route.startsWith('/dev/')) {
    // A first visit stores nothing, so there is no setting to fix yet. The first step of
    // the planting flow creates the saved game (still without a tree): fix the tier there.
    await page.goto(new URL('/start', base).href, { waitUntil: 'load', timeout: 180_000 });
    await page.getByRole('button', { name: /plant/i }).first().click();
    await page.waitForFunction(() => localStorage.getItem('touchgrass:game') !== null);
    await page.evaluate((tier) => {
      const save = JSON.parse(localStorage.getItem('touchgrass:game'));
      save.state.settings.graphics = tier;
      save.state.settings.sound = false;
      localStorage.setItem('touchgrass:game', JSON.stringify(save));
    }, TIER);
  }
  await page.goto(new URL(route, base).href, { waitUntil: 'load', timeout: 180_000 });
  await ready(page);
  return page;
}

/** Refuses a picture taken while the world was thinned out (development builds report it). */
async function onTier(page) {
  const stats = await page.evaluate(() => globalThis.__touchgrassWorld?.stats?.() ?? null);
  if (stats && (stats.tier !== TIER || stats.dprScale < 1)) {
    throw new Error(`the world is on ${stats.tier} at ${stats.dprScale} of its resolution`);
  }
}

/** Waits for the world to report that it has drawn, hides development-only chrome, settles. */
async function ready(page, settle = 1800) {
  await page
    .waitForFunction(
      () => ['ready', 'fallback'].includes(document.documentElement.dataset.world ?? ''),
      null,
      { timeout: 90_000 },
    )
    .catch(() => console.warn('  the world never reported ready'));
  // The framework's development badge is not part of the product.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}

async function gpuName(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
}

// --- Output ----------------------------------------------------------------------------------

const written = [];
function report(file) {
  const kb = statSync(file).size / 1024;
  written.push([path.basename(file), kb]);
  console.log(`  ${path.basename(file)}  ${kb.toFixed(0)} kB`);
}

/** Writes a screenshot as WebP, at most `width` pixels wide. */
async function still(buffer, name, { width, quality = 84 } = {}) {
  const file = path.join(outDir, `${name}.webp`);
  let image = sharp(buffer);
  if (width) image = image.resize({ width, withoutEnlargement: true, kernel: 'lanczos3' });
  await image.webp({ quality, effort: 6, smartSubsample: true }).toFile(file);
  report(file);
}

async function shoot(page, name, options) {
  const buffer = await page.screenshot({ type: 'png' });
  await onTier(page);
  await still(buffer, name, options);
}

const PILLOW = `
import json, sys
from PIL import Image
job = json.load(open(sys.argv[1]))
frames = [Image.open(name).convert('RGB') for name in job['frames']]
frames[0].save(job['out'], save_all=True, append_images=frames[1:], duration=job['delays'],
               loop=0, quality=job['quality'], method=job['method'], kmin=3, kmax=5)
`;

/**
 * Writes frames as one looping animated WebP. `delays` are milliseconds per frame.
 * A key frame every three to five frames stops slow colour changes from leaving stale blocks.
 */
async function animation(frames, delays, name, { width, quality = 60 } = {}) {
  const file = path.join(outDir, `${name}.webp`);
  const sized = await Promise.all(
    frames.map((frame) =>
      sharp(frame).resize({ width, kernel: 'lanczos3' }).png({ compressionLevel: 1 }).toBuffer(),
    ),
  );
  const keep = args.flags.has('keep-frames');
  const dir = keep
    ? path.join(outDir, `${name}-frames`)
    : mkdtempSync(path.join(os.tmpdir(), 'readme-media-'));
  if (keep) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const names = sized.map((frame, index) => {
    const frameFile = path.join(dir, `${String(index).padStart(3, '0')}.png`);
    writeFileSync(frameFile, frame);
    return frameFile;
  });
  const job = path.join(dir, 'job.json');
  // WEBP_METHOD (0 to 6) trades encoding time for size: 6 is the smallest file and the slowest.
  const method = Number(process.env.WEBP_METHOD ?? 6);
  writeFileSync(job, JSON.stringify({ frames: names, delays, quality, method, out: file }));
  const python = process.env.PYTHON ?? 'python';
  const encoded = spawnSync(python, ['-c', PILLOW, job], { encoding: 'utf8' });
  if (encoded.status !== 0) {
    console.warn(`  Pillow is not available through "${python}": encoding with sharp instead`);
    await sharp(sized, { join: { animated: true } })
      .webp({ quality, effort: 6, delay: delays, loop: 0, smartSubsample: true })
      .toFile(file);
  }
  if (!keep) rmSync(dir, { recursive: true, force: true });
  report(file);
}

/**
 * Records what happens in a region of the viewport while `action` runs. The browser's own
 * screencast delivers lossless frames at thirty or more a second; each is stamped as it
 * arrives, and the take is resampled to a steady `fps` so the motion plays at its real speed.
 */
async function record(page, clip, action, { fps = 10 } = {}) {
  const session = await page.context().newCDPSession(page);
  const shots = [];
  let started = 0;
  session.on('Page.screencastFrame', (event) => {
    session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    if (started > 0) shots.push({ at: performance.now() - started, data: event.data });
  });
  await session.send('Page.startScreencast', { format: 'png', everyNthFrame: 2 });
  await page.waitForTimeout(400);
  started = performance.now();
  await action();
  const length = performance.now() - started;
  await session.send('Page.stopScreencast');
  await session.detach();

  const picks = [];
  for (let t = 0; t <= length; t += 1000 / fps) {
    // The latest frame that had arrived by this instant.
    let pick = shots[0];
    for (const shot of shots) if (shot.at <= t) pick = shot;
    picks.push(pick);
  }
  const region = {
    left: Math.round(clip.x),
    top: Math.round(clip.y),
    width: Math.round(clip.width),
    height: Math.round(clip.height),
  };
  const frames = [];
  for (const pick of picks) {
    frames.push(
      await sharp(Buffer.from(pick.data, 'base64'))
        .extract(region)
        .png({ compressionLevel: 1 })
        .toBuffer(),
    );
  }
  const rate = ((shots.length / length) * 1000).toFixed(0);
  console.log(
    `  recorded ${shots.length} frames in ${(length / 1000).toFixed(1)} s (${rate} a second), kept ${frames.length}`,
  );
  await onTier(page);
  // A frame that is mostly the page's own mint paper means the canvas was not on screen
  // for it (it is cleared when its size changes, for instance): the take is no good.
  const paper = [240, 253, 244];
  for (const [index, frame] of frames.entries()) {
    const { data } = await sharp(frame)
      .resize(64)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let blank = 0;
    for (let i = 0; i < data.length; i += 3) {
      if (paper.every((value, channel) => Math.abs(data[i + channel] - value) < 10)) blank += 1;
    }
    if (blank / (data.length / 3) > 0.5) throw new Error(`frame ${index} is blank`);
  }
  return frames;
}

/** A take can be refused on a busy machine (see `onTier` and `record`): try it again, a few times. */
const retried = (task) => async () => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= 4) throw error;
      console.warn(`  take ${attempt} failed (${String(error.message).slice(0, 120)}): again`);
      for (const context of browser.contexts()) await context.close();
    }
  }
};

// --- Animated captures -----------------------------------------------------------------------

/**
 * The landing page has a time-lapse of a tree's first year that follows the scroll position.
 * This scrolls through it at an even pace, from the seed to the grand tree at dusk, and
 * records the stage. (The time-lapse goes on into the night; the capture stops before it.)
 */
async function timelapse() {
  const viewport = { width: 1440, height: 760 };
  const page = await open('/', { viewport, scale: 1 });
  console.log(`  graphics: ${await gpuName(page)}`);
  // Find where the seed starts to grow and where the tree has just become a grand tree.
  const range = await page.evaluate(async () => {
    const stage = document.querySelector('[data-world-stage]');
    const section = document.querySelector('section[aria-labelledby="time-lapse-title"]');
    const from = Math.round(
      section.getBoundingClientRect().top + window.scrollY - window.innerHeight,
    );
    const samples = [];
    for (let y = from; y < from + 5000; y += 20) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 90));
      if (stage.getBoundingClientRect().top < -0.5) break; // no longer pinned
      samples.push({
        y,
        growth: Number(stage.dataset.worldGrowth),
        label: stage.getAttribute('aria-label') ?? '',
      });
    }
    const lowest = Math.min(...samples.map((sample) => sample.growth));
    const seeds = samples.filter((sample) => sample.growth <= lowest + 1e-4);
    const last = samples[samples.length - 1];
    const grand = samples.find((sample) => /Grand tree/.test(sample.label)) ?? last;
    const start = seeds[seeds.length - 1].y;
    window.scrollTo({ top: start, behavior: 'instant' });
    return { start, end: Math.min(last.y, grand.y + 60) };
  });
  console.log(`  time-lapse from scroll ${range.start} to ${range.end}`);
  await page.waitForTimeout(2000);

  const bar = 100; // the navigation bar floats over the top of the stage
  const clip = { x: 0, y: bar, width: 888, height: viewport.height - bar };
  const seconds = 9;
  const fps = 10;
  const frames = await record(
    page,
    clip,
    () =>
      page.evaluate(
        ({ start, end, ms }) =>
          new Promise((resolve) => {
            const began = performance.now();
            const tick = (now) => {
              const t = Math.min(1, Math.max(0, (now - began - 500) / ms));
              window.scrollTo({ top: start + (end - start) * t, behavior: 'instant' });
              if (t < 1) requestAnimationFrame(tick);
              else setTimeout(resolve, 1000);
            };
            requestAnimationFrame(tick);
          }),
        { ...range, ms: seconds * 1000 },
      ),
    { fps },
  );
  // The loop opens on the grown tree, so the first frame (all a reader sees until the file
  // has loaded) is the finished picture; then it cuts back to the seed.
  const sequence = [frames[frames.length - 1], ...frames];
  const delays = sequence.map(() => 1000 / fps);
  delays[0] = 1400;
  delays[1] = 700;
  delays[delays.length - 1] = 300;
  await animation(sequence, delays, 'timelapse', { width: 720, quality: 60 });
  await page.context().close();
}

/** The world lab (development builds only): the stage alone, filling the window. */
const lab = (query) =>
  `/dev/world?bare=1&${new URLSearchParams({ quality: TIER, ...query }).toString()}`;

/** The lab's own Explore button is not part of the picture. */
const LAB_STYLE = '[data-world-stage] button{display:none!important}';

/**
 * The grown island turned once around by dragging it, as a person would: two strokes of half
 * a turn each. One stage width of dragging is 216 degrees (ORBIT.perStageWidth), so half a
 * turn is five sixths of the width. The take ends where it began, so the loop has no seam.
 */
async function turn() {
  const viewport = { width: 640, height: 640 };
  const page = await open(lab({ growth: 0.7, props: 'all', hour: 15.5, age: 200 }), {
    viewport,
    scale: 1,
    clock: false,
  });
  await page.addStyleTag({ content: LAB_STYLE });
  const stroke = (viewport.width * 180) / 216;
  const y = viewport.height * 0.6;
  const from = (viewport.width - stroke) / 2;
  const seconds = 2.7;
  const fps = 10;
  await page.mouse.move(from, y);
  await page.waitForTimeout(1500);
  const frames = await record(
    page,
    { x: 0, y: 0, ...viewport },
    async () => {
      for (let pass = 0; pass < 2; pass += 1) {
        await page.mouse.down();
        const began = performance.now();
        for (;;) {
          const t = Math.min(1, (performance.now() - began) / (seconds * 1000));
          // Ease in and out: the hand starts and stops gently, so nothing coasts on release.
          const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          await page.mouse.move(from + stroke * eased, y);
          if (t >= 1) break;
        }
        await page.mouse.up();
        await page.mouse.move(from, y, { steps: 6 });
        await page.waitForTimeout(150);
      }
    },
    { fps },
  );
  await animation(
    frames,
    frames.map(() => 1000 / fps),
    'turn',
    { width: 560, quality: 58 },
  );
  await page.context().close();
}

// --- Stills ----------------------------------------------------------------------------------

/** Each entry opens one page and takes its pictures; a refused picture is tried again. */
const STILLS = [
  async () => {
    const page = await open('/');
    console.log(`  graphics: ${await gpuName(page)}`);
    await shoot(page, 'landing');
  },
  async () => {
    const page = await open('/today', { state: 'day200' });
    await shoot(page, 'today');
    await page.getByRole('button', { name: /Explore the island/i }).click();
    await page.waitForTimeout(3200);
    await shoot(page, 'explore');
  },
  async () => {
    const page = await open('/log', { state: 'day200' });
    await page
      .getByRole('button', { name: /^Walk or bike/i })
      .first()
      .click();
    await page.waitForTimeout(900);
    await shoot(page, 'log-sheet');
    await page.getByRole('button', { name: 'Stick it on' }).click();
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(400);
    await shoot(page, 'log-receipt');
  },
  // The estimate mark on a logged action opens the formula, the comparison, the range and the source.
  async () => {
    const page = await open('/log', { state: 'day200' });
    await page.getByRole('button', { name: 'About this estimate' }).first().click();
    await page.waitForTimeout(800);
    await shoot(page, 'estimate');
  },
  async () => {
    const page = await open('/quests', { state: 'day200' });
    await shoot(page, 'quests');
  },
  async () => {
    const page = await open('/impact', { state: 'day200' });
    await shoot(page, 'impact');
  },
  // The real clock here: "Live" is only shown for a reading fetched in the last 36 hours.
  async () => {
    const page = await open('/impact', { state: 'day200', clock: false });
    await page.getByText('The planet now', { exact: true }).click();
    await page.waitForTimeout(6000);
    await shoot(page, 'planet');
  },
  // The coach drawer over Today (the C key), asked one of its own suggestions.
  async () => {
    const page = await open('/today', { state: 'day200' });
    await page.keyboard.press('c');
    await page.waitForTimeout(1500);
    await page
      .getByRole('button', { name: /biggest lever/i })
      .first()
      .click();
    await page.waitForTimeout(4500);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role=dialog] *')) {
        if (el.scrollHeight > el.clientHeight + 4) el.scrollTop = 0;
      }
    });
    await page.waitForTimeout(500);
    await shoot(page, 'coach');
  },
  async () => {
    const page = await open('/me', { state: 'day200' });
    await shoot(page, 'passport');
    const dataTab = page.getByRole('tab', { name: /^Data/ });
    await dataTab.click();
    await page.waitForTimeout(600);
    await dataTab.evaluate((tab) => {
      const top = tab.getBoundingClientRect().top + window.scrollY - 104;
      window.scrollTo({ top, behavior: 'instant' });
    });
    await page.waitForTimeout(700);
    await shoot(page, 'data');
  },
  // The demo world keeps its own saved game, with the quality on Auto: retried if it thinned out.
  async () => {
    const page = await open('/demo');
    await page.waitForURL(/\/today/, { timeout: 60_000 });
    await ready(page, 3500);
    await shoot(page, 'demo');
  },
];

const PHONE_STILLS = [
  ['/today', 'phone-today'],
  ['/log', 'phone-log'],
  ['/quests', 'phone-quests'],
].map(([route, name]) => async () => {
  const page = await open(route, { state: 'day200', phone: true });
  await shoot(page, name, { quality: 82 });
});

/** Runs each take, closes its page, and tries a refused take again. */
async function takes(list) {
  for (const take of list) {
    await retried(take)();
    for (const context of browser.contexts()) await context.close();
  }
}

const stills = () => takes(STILLS);
const phone = () => takes(PHONE_STILLS);

/** One square picture of the lab per entry: `[file name, lab query]`. */
async function tiles(entries, size, width) {
  for (const [name, query] of entries) {
    const page = await open(lab(query), {
      viewport: { width: size, height: size },
      scale: 1,
      clock: false,
    });
    await page.addStyleTag({ content: LAB_STYLE });
    await page.waitForTimeout(900);
    await shoot(page, name, { width, quality: 80 });
    await page.context().close();
  }
}

/** The nine stages the rules engine names, at the growth each starts at (src/game/economy.ts). */
const STAGES = [
  ['seed', 0.012],
  ['sprout', 0.03],
  ['seedling', 0.07],
  ['sapling', 0.12],
  ['young-tree', 0.35],
  ['mature-tree', 0.65],
  ['grand-tree', 0.8],
  ['elder', 0.9],
  ['ancient', 0.96],
];

const stages = () =>
  tiles(
    STAGES.map(([id, growth], index) => [`stage-${index + 1}-${id}`, { growth, hour: 13 }]),
    520,
    360,
  );

const skies = () =>
  tiles(
    [
      ['sky-dawn', 6.2],
      ['sky-day', 13],
      ['sky-golden', 18.2],
      ['sky-night', 23],
    ].map(([name, hour]) => [name, { growth: 0.66, props: 'all', hour, age: 200 }]),
    560,
    420,
  );

const species = () =>
  tiles(
    ['oak', 'cherry', 'pine'].map((id) => [
      `species-${id}`,
      { species: id, growth: 0.7, hour: 14 },
    ]),
    560,
    420,
  );

const RECIPES = {
  timelapse: retried(timelapse),
  turn: retried(turn),
  stills,
  phone,
  stages,
  skies,
  species,
};

try {
  for (const task of tasks) {
    console.log(task);
    await RECIPES[task]();
  }
} finally {
  await browser.close();
}

const total = written.reduce((sum, [, kb]) => sum + kb, 0);
console.log(`\n${written.length} file(s), ${(total / 1024).toFixed(2)} MB`);
