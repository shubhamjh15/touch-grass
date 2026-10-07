#!/usr/bin/env node
/**
 * Makes the share card (public/og-card.png, used for Open Graph and Twitter) from the real app:
 * the landing page at 1200x630, with the clock held at noon so the island is in daylight
 * whatever time the picture is taken.
 *
 *   node scripts/og-image.mjs --base http://localhost:4173
 *
 * Needs a running server (production build for the cleanest picture: the dev server draws its
 * own "Compiling" badge, which is hidden here).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const flag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const base = flag('base', 'http://localhost:4173');
const out = path.resolve(root, flag('out', 'public/og-card.png'));

const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({
  channel,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    serviceWorkers: 'block',
  });
  // Only the date is frozen; timers and animation frames keep running.
  await context.clock.setFixedTime(new Date('2026-10-06T12:00:00+05:30'));
  const page = await context.newPage();
  await page.goto(new URL('/', base).href, { timeout: 120_000 });
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-toast] { display: none !important; }',
  });
  await page.waitForSelector('canvas', { timeout: 60_000 });
  // The island grows in; give the scene a few real seconds to settle.
  await page.waitForTimeout(6000);
  mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
