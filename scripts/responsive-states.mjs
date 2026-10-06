#!/usr/bin/env node
/**
 * Responsive sweep of the screens a URL cannot reach: the coach drawer, the command palette, the quick-log
 * sheet, quest details, a lesson quiz, the More sheet on phones, and every tab of every tab list.
 * It runs the same in-page checks as responsive-audit.mjs on each state.
 *
 *   node scripts/responsive-states.mjs [--widths 320,390,768] [--state day200] [--only coach,palette] [--height 390 --phone true] [--out file.json]
 *
 * Exits 1 when anything is found or a state could not be reached.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { inspect } from './responsive-inspect.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const base = args.base ?? 'http://localhost:5173';
const widths = (args.widths ?? '320,390,768').split(',').map(Number);
const stateName = args.state ?? 'day200';
const only = args.only ? args.only.split(',') : null;

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

const settle = (page, ms = 700) => page.waitForTimeout(ms);

/** Clicks the first match; throws a readable error when the state cannot be reached. */
async function click(page, selector, what) {
  const target = page.locator(selector).locator('visible=true').first();
  try {
    await target.waitFor({ state: 'visible', timeout: 5_000 });
    await target.click({ timeout: 5_000 });
  } catch {
    throw new Error(`could not reach "${what ?? selector}"`);
  }
}

/** Every tab of every tab list on the page, one state each. */
async function eachTab(page, visit) {
  const lists = await page.locator('[role="tablist"]').count();
  for (let l = 0; l < lists; l += 1) {
    const tabs = page.locator('[role="tablist"]').nth(l).locator('[role="tab"]');
    const count = await tabs.count();
    for (let t = 0; t < count; t += 1) {
      const tab = page.locator('[role="tablist"]').nth(l).locator('[role="tab"]').nth(t);
      const label = ((await tab.textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      await tab.scrollIntoViewIfNeeded().catch(() => {});
      await tab.click({ timeout: 5_000 }).catch(() => {});
      await settle(page, 500);
      await visit(`tab ${l + 1}.${t + 1} "${label}"`);
    }
  }
}

/** A scenario: the route it opens on, whether it needs a phone, and the steps that reach each state. */
const SCENARIOS = [
  {
    id: 'coach',
    route: 'today',
    run: async (page, report) => {
      await click(page, '[aria-label="Ask Moss, your coach"]', 'Ask Moss');
      await settle(page, 900);
      await report('coach drawer');
    },
  },
  {
    id: 'palette',
    route: 'today',
    run: async (page, report) => {
      await page.keyboard.press('Control+K');
      await settle(page);
      await report('command palette');
      await page.keyboard.type('log');
      await settle(page, 400);
      await report('command palette, typed');
    },
  },
  {
    id: 'more',
    route: 'today',
    phoneOnly: true,
    run: async (page, report) => {
      await click(page, 'button[aria-haspopup="dialog"]:has-text("More")', 'More');
      await settle(page, 900);
      await report('More sheet');
    },
  },
  {
    id: 'quicklog',
    route: 'log',
    run: async (page, report) => {
      await click(page, '[data-tile]', 'first sticker');
      await settle(page, 900);
      await report('quick-log sheet');
    },
  },
  {
    id: 'quests',
    route: 'quests',
    run: async (page, report) => {
      await settle(page);
      await report('quests board');
      const toggles = page.locator('main button[aria-expanded="false"]');
      const n = Math.min(await toggles.count(), 6);
      for (let i = 0; i < n; i += 1) {
        await toggles
          .nth(0)
          .click({ timeout: 3_000 })
          .catch(() => {});
        await settle(page, 300);
      }
      await report('quests expanded');
    },
  },
  {
    id: 'quiz',
    route: 'learn/big-levers',
    run: async (page, report) => {
      await click(
        page,
        'button:has-text("Start quiz"), button:has-text("Try again"), button:has-text("Retake quiz")',
        'Start quiz',
      );
      await settle(page, 600);
      await report('quiz question');
      for (let q = 0; q < 3; q += 1) {
        await page
          .locator('main ul[aria-labelledby] button')
          .first()
          .click({ timeout: 3_000 })
          .catch(() => {});
        await settle(page, 500);
        if (q === 0) await report('quiz answered');
        await page
          .locator(
            'button:has-text("Next"), button:has-text("See result"), button:has-text("Finish")',
          )
          .first()
          .click({ timeout: 3_000 })
          .catch(() => {});
        await settle(page, 400);
      }
      await report('quiz later');
    },
  },
  ...['me', 'community', 'impact', 'learn', 'quests', 'log'].map((route) => ({
    id: `tabs-${route}`,
    route,
    run: async (page, report) => {
      await eachTab(page, report);
    },
  })),
];

const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
const browser = await chromium.launch({
  channel,
  headless: true,
  args: ['--disable-gpu', '--disable-3d-apis'],
});

const results = [];
try {
  const seed = loadState(stateName);
  for (const width of widths) {
    const phone = 'phone' in args || width < 768;
    const context = await browser.newContext({
      viewport: { width, height: Number(args.height ?? (phone ? 800 : 900)) },
      deviceScaleFactor: 1,
      hasTouch: phone,
      isMobile: phone,
    });
    await context.addInitScript((items) => {
      if (sessionStorage.getItem('__audit_seeded')) return;
      for (const [key, value] of items) localStorage.setItem(key, value);
      sessionStorage.setItem('__audit_seeded', '1');
    }, seed);
    const page = await context.newPage();
    let errors = [];
    page.on(
      'console',
      (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`),
    );
    page.on('pageerror', (e) => errors.push(`page: ${String(e).slice(0, 200)}`));

    for (const scenario of SCENARIOS) {
      if (only && !only.includes(scenario.id)) continue;
      if (scenario.phoneOnly && !phone) continue;
      const report = async (name) => {
        const entry = {
          width,
          scenario: scenario.id,
          state: name,
          issues: await page.evaluate(inspect, phone),
        };
        for (const text of [...new Set(errors)].slice(0, 3))
          entry.issues.push({ type: 'errors', where: '', text: '', detail: text });
        errors = [];
        results.push(entry);
        console.log(
          `${String(width).padStart(5)}  ${(scenario.id + ' / ' + name).padEnd(44)} ${entry.issues.length ? `${entry.issues.length} issues` : 'clean'}`,
        );
        for (const issue of entry.issues)
          console.log(
            `         ${issue.type.padEnd(13)} ${issue.where}  ${issue.text ? `"${issue.text}"  ` : ''}${issue.detail}`,
          );
      };
      errors = [];
      try {
        await page.goto(new URL(`/${scenario.route}`, base).href, {
          waitUntil: 'load',
          timeout: 60_000,
        });
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        await settle(page, 800);
        await scenario.run(page, report);
      } catch (error) {
        results.push({
          width,
          scenario: scenario.id,
          state: 'unreachable',
          issues: [
            { type: 'unreachable', where: '', text: '', detail: String(error.message ?? error) },
          ],
        });
        console.log(
          `${String(width).padStart(5)}  ${scenario.id.padEnd(44)} UNREACHABLE: ${error.message ?? error}`,
        );
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const total = results.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n${results.length} states checked, ${total} issues`);
if (args.out)
  writeFileSync(
    path.resolve(args.out),
    JSON.stringify({ base, state: stateName, widths, results }, null, 1),
  );
process.exit(total ? 1 : 0);
