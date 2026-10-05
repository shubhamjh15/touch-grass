#!/usr/bin/env node
/**
 * Visual QA helper: opens a route in a headless browser, optionally seeds the
 * saved game state, takes a screenshot and reports anything that went wrong on
 * the page (console errors, crashes, failed or third-party requests).
 *
 *   node scripts/shot.mjs --route /today --out shots/today.png
 *   node scripts/shot.mjs --route /log --device mobile --state day12 --scroll 600
 *   node scripts/shot.mjs --route / --scrolls 0,900,1800 --out shots/landing.png
 *
 * Flags
 *   --route <path>        Route to open (default "/"). The leading slash is optional:
 *                         in Git Bash write "--route today", because MSYS rewrites
 *                         "/today" into a Windows path (the script undoes that too).
 *   --out <file.png>      Output file (default "shot.png"). With --scrolls a
 *                         "-<n>" suffix is added per scroll position.
 *   --device <name>       "desktop" (1440x900, default), "laptop" (1280x720),
 *                         "tablet" (820x1180) or "mobile" (390x844, touch, DPR 3).
 *   --viewport <WxH>      Custom viewport, overrides --device size.
 *   --state <name|file>   Seed localStorage from scripts/fixtures/<name>.json or
 *                         a JSON file path ({ "<key>": <value>, ... }).
 *   --scroll <px>         Scroll the page before the screenshot.
 *   --scrolls <a,b,c>     Take one screenshot per scroll position.
 *   --full                Capture the full scrollable page (the fixed 3D canvas
 *                         is only drawn in the first viewport).
 *   --click <selector>    Click an element (Playwright selector) first. Repeatable.
 *   --press <key>         Press a key first, e.g. "Control+K". Repeatable.
 *   --eval <js>           Run a script in the page first. Repeatable.
 *   --wait <ms>           Extra settle time before capturing (default 900).
 *   --reduced-motion      Emulate prefers-reduced-motion: reduce.
 *   --no-webgl            Disable WebGL to exercise the illustrated fallback.
 *   --base <url>          Server origin (default http://localhost:5173).
 */
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const single = {
    route: '/',
    out: 'shot.png',
    device: 'desktop',
    wait: '900',
    base: 'http://localhost:5173',
  };
  const multi = { click: [], press: [], eval: [] };
  const flags = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (['full', 'reduced-motion', 'no-webgl'].includes(key)) {
      flags.add(key);
    } else if (key in multi) {
      multi[key].push(argv[(i += 1)]);
    } else {
      single[key] = argv[(i += 1)];
    }
  }
  return { ...single, ...multi, flags };
}

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  },
};

function loadState(name) {
  if (!name) return null;
  const candidates = [path.join(here, 'fixtures', `${name}.json`), path.resolve(name)];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error(`State fixture not found: ${name}`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return Object.entries(data).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]);
}

function normalizeRoute(input) {
  let route = String(input ?? '/');
  // Git Bash on Windows rewrites "/today" into "C:/Program Files/Git/today".
  const mangled = route.match(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]?(.*)$/);
  if (mangled) route = mangled[1];
  route = route.replace(/\\/g, '/');
  return route.startsWith('/') ? route : `/${route}`;
}

const args = parseArgs(process.argv.slice(2));
args.route = normalizeRoute(args.route);
const device = { ...(DEVICES[args.device] ?? DEVICES.desktop) };
if (args.viewport) {
  const [width, height] = args.viewport.split('x').map(Number);
  device.viewport = { width, height };
}

const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({
  channel,
  headless: true,
  args: args.flags.has('no-webgl')
    ? ['--disable-gpu', '--disable-3d-apis']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const report = {
  ok: true,
  url: '',
  files: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  externalRequests: [],
};

try {
  const context = await browser.newContext({
    ...device,
    reducedMotion: args.flags.has('reduced-motion') ? 'reduce' : 'no-preference',
  });

  const entries = loadState(args.state);
  if (entries) {
    await context.addInitScript((items) => {
      // Seed once per tab so in-page changes survive client-side navigation.
      if (sessionStorage.getItem('__shot_seeded')) return;
      for (const [key, value] of items) localStorage.setItem(key, value);
      sessionStorage.setItem('__shot_seeded', '1');
    }, entries);
  }

  const page = await context.newPage();
  const origin = new URL(args.base).origin;
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 400));
  });
  page.on('pageerror', (error) =>
    report.pageErrors.push(String(error.stack ?? error).slice(0, 600)),
  );
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (!failure.includes('ERR_ABORTED')) report.failedRequests.push(`${request.url()} ${failure}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http') && new URL(url).origin !== origin) report.externalRequests.push(url);
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      report.failedRequests.push(`${response.url()} ${response.status()}`);
  });

  report.url = new URL(args.route, args.base).href;
  await page.goto(report.url, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  // The world marks <html data-world="ready|fallback"> once it has drawn.
  await page
    .waitForFunction(
      () => ['ready', 'fallback'].includes(document.documentElement.dataset.world ?? ''),
      null,
      {
        timeout: 15_000,
      },
    )
    .catch(() =>
      report.consoleErrors.push('[shot] world never reported ready/fallback within 15s'),
    );

  for (const script of args.eval) await page.evaluate(script);
  for (const selector of args.click) {
    await page.click(selector, { timeout: 8_000 });
    await page.waitForTimeout(350);
  }
  for (const key of args.press) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }

  const out = path.resolve(args.out);
  mkdirSync(path.dirname(out), { recursive: true });
  const positions = args.scrolls ? args.scrolls.split(',').map(Number) : [Number(args.scroll ?? 0)];

  for (const [index, y] of positions.entries()) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(Number(args.wait));
    const file = positions.length > 1 ? out.replace(/\.png$/i, `-${index + 1}.png`) : out;
    await page.screenshot({ path: file, fullPage: args.flags.has('full') });
    report.files.push(file);
  }

  report.title = await page.title();
  report.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  report.world = await page.evaluate(() => document.documentElement.dataset.world ?? null);
} catch (error) {
  report.ok = false;
  report.error = String(error.stack ?? error).slice(0, 800);
} finally {
  await browser.close();
}

report.externalRequests = [...new Set(report.externalRequests)];
if (report.pageErrors.length > 0) report.ok = false;
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
