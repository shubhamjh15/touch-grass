#!/usr/bin/env node
/**
 * Measures how smooth the 3D world is on this machine's real GPU.
 *
 *   node scripts/world-perf.mjs [options]
 *
 *   --base <url>       Default http://localhost:5173 (measure a production build for real numbers)
 *   --route <path>     Route without the leading slash. Default today
 *   --state <name>     Saved state from scripts/fixtures. Default day45
 *   --seconds <n>      Sampling time per phase. Default 6
 *   --viewport <WxH>   Default 1440x900
 *   --headed           Show the browser window (closest to what a person sees)
 *
 * Phases: idle (nothing touched), drag (the island is orbited with the mouse), scroll (the
 * page is scrolled down and back). For each it reports the frame interval seen by
 * requestAnimationFrame: median, 95th and 99th percentile, the share of frames over 20 ms
 * (a visible stutter on a 60 Hz screen) and the longest frame. During the scroll phase it
 * also reports how far the canvas strays from the stage it is drawn for, in pixels: anything
 * above 1 px is seen as the world swimming against the page.
 *
 * Target on integrated graphics: median <= 17 ms, p95 <= 20 ms, under 3 % of frames over 20 ms
 * in every phase, and no drift.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = { flags: new Set() };
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i].replace(/^--/, '');
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args.flags.add(key);
  else {
    args[key] = next;
    i += 1;
  }
}
const base = args.base ?? 'http://localhost:5173';
const route = String(args.route ?? 'today').replace(/^\//, '');
const seconds = Number(args.seconds ?? 6);
const [width, height] = (args.viewport ?? '1440x900').split('x').map(Number);

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

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
  headless: !args.flags.has('headed'),
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--disable-gpu-vsync=false',
  ],
});

try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(
    (items) => {
      if (sessionStorage.getItem('__perf_seeded')) return;
      for (const [key, value] of items) localStorage.setItem(key, value);
      sessionStorage.setItem('__perf_seeded', '1');
    },
    loadState(args.state ?? 'day45'),
  );
  const page = await context.newPage();
  await page.goto(new URL(`/${route}`, base).href, { waitUntil: 'load', timeout: 90_000 });
  await page
    .waitForFunction(
      () => ['ready', 'fallback'].includes(document.documentElement.dataset.world ?? ''),
      null,
      { timeout: 60_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500);

  const device = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const canvas = [...document.querySelectorAll('canvas')].sort(
      (a, b) => b.width * b.height - a.width * a.height,
    )[0];
    return {
      world: document.documentElement.dataset.world ?? null,
      gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown',
      canvas: canvas
        ? {
            buffer: `${canvas.width}x${canvas.height}`,
            css: `${Math.round(canvas.clientWidth)}x${Math.round(canvas.clientHeight)}`,
          }
        : null,
      megapixels: canvas ? Number(((canvas.width * canvas.height) / 1e6).toFixed(2)) : 0,
    };
  });

  /** Samples requestAnimationFrame intervals (and canvas drift) for a while, inside the page. */
  const sample = (ms) =>
    page.evaluate(
      (duration) =>
        new Promise((resolve) => {
          const canvas = [...document.querySelectorAll('canvas')].sort(
            (a, b) => b.width * b.height - a.width * a.height,
          )[0];
          const stage = document.querySelector('[data-world-stage]');
          const intervals = [];
          let drift = 0;
          let last = performance.now();
          const end = last + duration;
          const tick = (now) => {
            intervals.push(now - last);
            last = now;
            if (canvas && stage) {
              const a = canvas.getBoundingClientRect();
              const b = stage.getBoundingClientRect();
              drift = Math.max(drift, Math.abs(a.top - b.top), Math.abs(a.left - b.left));
            }
            if (now < end) requestAnimationFrame(tick);
            else {
              const sorted = intervals.slice(1).sort((x, y) => x - y);
              const at = (q) =>
                sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
              resolve({
                frames: sorted.length,
                fps: Number(
                  (1000 / (sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length))).toFixed(
                    1,
                  ),
                ),
                medianMs: Number(at(0.5).toFixed(1)),
                p95Ms: Number(at(0.95).toFixed(1)),
                p99Ms: Number(at(0.99).toFixed(1)),
                worstMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(1)),
                over20: `${((sorted.filter((v) => v > 20).length / Math.max(1, sorted.length)) * 100).toFixed(1)} %`,
                driftPx: stage ? Number(drift.toFixed(1)) : 'no [data-world-stage] element',
              });
            }
          };
          requestAnimationFrame(tick);
        }),
      ms,
    );

  const report = { url: page.url(), device, phases: {} };
  report.phases.idle = await sample(seconds * 1000);

  const dragging = sample(seconds * 1000);
  const cx = width / 2;
  const cy = Math.min(height / 2, 360);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < seconds * 20; i += 1) {
    await page.mouse.move(cx + Math.sin(i / 6) * 220, cy + Math.cos(i / 9) * 30);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  report.phases.drag = await dragging;

  const scrolling = sample(seconds * 1000);
  for (let i = 0; i < seconds * 10; i += 1) {
    await page.mouse.wheel(0, i < seconds * 5 ? 60 : -60);
    await page.waitForTimeout(90);
  }
  report.phases.scroll = await scrolling;

  report.worldStats = await page.evaluate(() => globalThis.__touchgrassWorld?.stats?.() ?? null);
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
}
