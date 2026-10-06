#!/usr/bin/env node
/**
 * Responsive sweep: loads every route at a ladder of viewport widths and reports
 * layout defects a person would notice on a real device.
 *
 *   node scripts/responsive-audit.mjs [options]
 *
 *   --base <url>        Default http://localhost:5173
 *   --routes <a,b,c>    Routes without the leading slash ("" is the landing page).
 *                       Default: every public and app route, one lesson and a 404.
 *   --widths <a,b,c>    Default 320,390,768,1024,1440. --full adds 360,414,600,1280,1920.
 *   --state <name>      Saved state for the app routes (scripts/fixtures). Default day12.
 *                       Public routes and /start always load as a first-time visitor.
 *   --webgl             Draw the live 3D world (slow). Default: the illustrated fallback.
 *   --out <file>        Also write the full report as JSON.
 *
 * Checks, per route and width:
 *   overflow      the page scrolls sideways; lists the elements that stick out
 *   cut-off       content runs past the viewport or past a clipping container
 *   text-clipped  text is cut by its own box without an ellipsis
 *   text-small    text under 11 px (the smallest size in the type scale)
 *   tap-small     touch targets under 32 px on phone widths (44 px is the goal)
 *   errors        console errors, page errors and failed requests
 *
 * Exits 1 when anything is found, so it can gate a release.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { inspect } from './responsive-inspect.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { flags: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out.flags.add(key);
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const base = args.base ?? 'http://localhost:5173';
const PUBLIC_ROUTES = ['', 'methodology', 'privacy', 'this-page-does-not-exist'];
const APP_ROUTES = ['today', 'log', 'quests', 'learn', 'impact', 'community', 'coach', 'me'];
const routes =
  args.routes !== undefined ? args.routes.split(',') : [...PUBLIC_ROUTES, 'start', ...APP_ROUTES];
const widths = (
  args.widths ??
  (args.flags.has('full') ? '320,360,390,414,600,768,1024,1280,1440,1920' : '320,390,768,1024,1440')
)
  .split(',')
  .map(Number);
const stateName = args.state ?? 'day12';

function loadState(name) {
  const file = [path.join(here, 'fixtures', `${name}.json`), path.resolve(name)].find((f) =>
    existsSync(f),
  );
  if (!file) throw new Error(`State fixture not found: ${name}`);
  return Object.entries(JSON.parse(readFileSync(file, 'utf8'))).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]);
}

const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({
  channel,
  headless: true,
  args: args.flags.has('webgl')
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--disable-gpu', '--disable-3d-apis'],
});

const results = [];
try {
  const seed = loadState(stateName);
  for (const width of widths) {
    const phone = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 800 : 900 },
      deviceScaleFactor: 1,
      hasTouch: phone,
      isMobile: phone,
    });
    // Public routes and onboarding are judged as a first-time visitor sees them; the app routes with the saved state.
    await context.addInitScript(
      ({ items, fresh }) => {
        const first = location.pathname.split('/')[1] ?? '';
        if (fresh.includes(first) || sessionStorage.getItem('__audit_seeded')) return;
        for (const [key, value] of items) localStorage.setItem(key, value);
        sessionStorage.setItem('__audit_seeded', '1');
      },
      { items: seed, fresh: [...PUBLIC_ROUTES, 'start'] },
    );
    const page = await context.newPage();
    let errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // The browser logs the deliberate 404 of the not-found route as a console error: that is the page working.
      const expected404 =
        m.text().includes('status of 404') && m.location().url.includes('this-page-does-not-exist');
      if (!expected404) errors.push(`console: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => errors.push(`page: ${String(e).slice(0, 200)}`));
    page.on('response', (r) => {
      const expected404 = r.status() === 404 && r.url().includes('this-page-does-not-exist');
      if (r.status() >= 400 && !expected404) errors.push(`${r.status()} ${r.url()}`);
    });

    const queue = [...routes];
    let lessonAdded = args.routes !== undefined;
    while (queue.length) {
      const route = queue.shift();
      errors = [];
      const entry = { route: `/${route}`, width, issues: [] };
      try {
        if ([...PUBLIC_ROUTES, 'start'].includes(route.split('/')[0])) {
          await page
            .goto(new URL('/privacy', base).href, { waitUntil: 'commit', timeout: 60_000 })
            .catch(() => {});
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        }
        await page.goto(new URL(`/${route}`, base).href, { waitUntil: 'load', timeout: 60_000 });
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        await page
          .waitForFunction(
            () => ['ready', 'fallback'].includes(document.documentElement.dataset.world ?? ''),
            null,
            { timeout: 8_000 },
          )
          .catch(() => {});
        await page.waitForTimeout(500);
        entry.landed = new URL(page.url()).pathname;
        entry.issues = await page.evaluate(inspect, phone);
        if (!lessonAdded && route === 'learn') {
          const lesson = await page.evaluate(
            () => document.querySelector('a[href^="/learn/"]')?.getAttribute('href') ?? null,
          );
          if (lesson) queue.unshift(lesson.replace(/^\//, ''));
          lessonAdded = true;
        }
      } catch (error) {
        errors.push(`audit: ${String(error).slice(0, 200)}`);
      }
      for (const text of [...new Set(errors)].slice(0, 5))
        entry.issues.push({ type: 'errors', where: '', text: '', detail: text });
      results.push(entry);
      const count = entry.issues.length;
      console.log(
        `${String(width).padStart(5)}  ${entry.route.padEnd(30)} ${count ? `${count} issue${count > 1 ? 's' : ''}` : 'clean'}`,
      );
      for (const issue of entry.issues)
        console.log(
          `         ${issue.type.padEnd(13)} ${issue.where}  ${issue.text ? `"${issue.text}"  ` : ''}${issue.detail}`,
        );
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const total = results.reduce((n, r) => n + r.issues.length, 0);
const byType = {};
for (const r of results) for (const i of r.issues) byType[i.type] = (byType[i.type] ?? 0) + 1;
console.log(
  `\n${results.length} pages checked, ${total} issues`,
  total ? JSON.stringify(byType) : '',
);
if (args.out)
  writeFileSync(
    path.resolve(args.out),
    JSON.stringify({ base, state: stateName, widths, results }, null, 1),
  );
process.exit(total ? 1 : 0);
