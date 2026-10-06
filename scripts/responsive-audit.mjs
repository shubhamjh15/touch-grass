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

/** Runs inside the page. Returns the defects found in the current document. */
function inspect(phone) {
  const vw = window.innerWidth;
  const TOLERANCE = 4;
  const issues = [];
  const push = (type, el, detail) => {
    if (issues.filter((i) => i.type === type).length >= 6) return;
    const parts = [];
    for (
      let node = el, depth = 0;
      node && node !== document.body && depth < 3;
      node = node.parentElement, depth += 1
    ) {
      const cls =
        typeof node.className === 'string'
          ? node.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
      parts.unshift(node.tagName.toLowerCase() + (node.id ? `#${node.id}` : cls ? `.${cls}` : ''));
    }
    issues.push({
      type,
      where: parts.join(' > '),
      text: (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50),
      detail,
    });
  };
  const visible = (el, rect, style) =>
    rect.width >= 2 &&
    rect.height >= 2 &&
    style.display !== 'none' &&
    style.visibility === 'visible' &&
    Number(style.opacity) > 0.05 &&
    !el.closest('[aria-hidden="true"], [inert], .sr-only');
  /** Touch area including a pseudo-element that enlarges it (the kit's "hit" helpers). */
  const hitBox = (el, rect) => {
    let width = rect.width;
    let height = rect.height;
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo);
      if (style.content === 'none' || style.position !== 'absolute') continue;
      const n = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
      width = Math.max(width, rect.width - n(style.left) - n(style.right));
      height = Math.max(height, rect.height - n(style.top) - n(style.bottom));
    }
    return { width, height };
  };
  const ownText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  /** The nearest ancestor that clips or scrolls sideways; null when only the page itself does. */
  const clipper = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed') return { node, fixed: true, scrolls: false };
      if (/(auto|scroll)/.test(style.overflowX)) return { node, fixed: false, scrolls: true };
      if (/(hidden|clip)/.test(style.overflowX)) return { node, fixed: false, scrolls: false };
    }
    return null;
  };

  const pageScrolls = document.documentElement.scrollWidth > vw + 1;
  if (pageScrolls)
    issues.push({
      type: 'overflow',
      where: 'html',
      text: '',
      detail: `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`,
    });

  const interactive =
    'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]';
  const sticking = [];
  for (const el of document.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (!visible(el, rect, style)) continue;
    const isContent =
      ownText(el) || el.matches(interactive) || /^(img|svg|canvas|video)$/i.test(el.tagName);
    const fixed = style.position === 'fixed';
    const clip = clipper(el);

    // Sticks out of the viewport without anything clipping it.
    if (!fixed && !clip && (rect.right > vw + TOLERANCE || rect.left < -TOLERANCE)) {
      const decorative = style.pointerEvents === 'none' && !ownText(el);
      if (pageScrolls || !decorative) sticking.push({ el, rect });
    }
    // Runs past a clipping container that cannot be scrolled.
    if (isContent && clip && !clip.scrolls && !clip.fixed) {
      const box = clip.node.getBoundingClientRect();
      const over = Math.max(rect.right - box.right, box.left - rect.left);
      if (over > 8 && style.pointerEvents !== 'none')
        push('cut-off', el, `${Math.round(over)}px past its container`);
    }
    if (ownText(el)) {
      const size = parseFloat(style.fontSize);
      if (size < 11) push('text-small', el, `${size}px`);
      const clipsX = /(hidden|clip)/.test(style.overflowX) && style.textOverflow !== 'ellipsis';
      if (clipsX && el.scrollWidth - el.clientWidth > 2)
        push('text-clipped', el, `${el.scrollWidth - el.clientWidth}px hidden sideways`);
      const clamps = style.webkitLineClamp && style.webkitLineClamp !== 'none';
      if (/(hidden|clip)/.test(style.overflowY) && !clamps && el.scrollHeight - el.clientHeight > 4)
        push('text-clipped', el, `${el.scrollHeight - el.clientHeight}px hidden below`);
    }
    if (phone && el.matches(interactive) && style.display !== 'inline') {
      const label = el.closest('label');
      const hit = label ? label.getBoundingClientRect() : hitBox(el, rect);
      if (Math.min(hit.width, hit.height) < 32)
        push('tap-small', el, `${Math.round(hit.width)}x${Math.round(hit.height)}px`);
    }
  }
  // Report the innermost elements that stick out: they name the real culprit.
  for (const { el, rect } of sticking) {
    if (sticking.some((other) => other.el !== el && el.contains(other.el))) continue;
    push(
      pageScrolls ? 'overflow' : 'cut-off',
      el,
      `spans ${Math.round(rect.left)}..${Math.round(rect.right)}px of ${vw}px`,
    );
  }
  return issues;
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
