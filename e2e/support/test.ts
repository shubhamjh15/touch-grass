import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { ORIGIN } from './seeds';

/**
 * The suite's `test`: a context with a controlled clock and, by default, no WebGL, plus a
 * health monitor that fails any test in which the app logs a console error, throws, asks a
 * third party for anything or gets an error response. Specs that judge the 3D world turn
 * WebGL on with `test.use({ webgl: true })`.
 */

/** Late morning on the day every fixture was generated for (the fixtures end at 10:30). */
export const MORNING = '2026-10-06T11:00:00+05:30';
/** The next morning: a fixture state meets a new day. */
export const NEXT_MORNING = '2026-10-07T09:00:00+05:30';

/**
 * Hides WebGL from the page and records what the app asked for. A scene that cannot get a
 * context must fall back to the illustrated tree without complaint.
 */
const NO_WEBGL = `(() => {
  if ('__glAsked' in window) return;
  const asked = [];
  Object.defineProperty(window, '__glAsked', { value: asked });
  const wrap = (proto) => {
    const original = proto.getContext;
    proto.getContext = function (type, ...rest) {
      if (/webgl/i.test(String(type))) {
        asked.push(String(type));
        return null;
      }
      return original.call(this, type, ...rest);
    };
  };
  wrap(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== 'undefined') wrap(OffscreenCanvas.prototype);
})();`;

/**
 * Real WebGL, with a record of every context the page created (`__glContexts`, and their
 * kinds in `__glMade`) and a count of every draw call (`__glDraws`), so a spec can tell
 * whether the scene is rendering without asking the app.
 */
const COUNT_WEBGL = `(() => {
  if ('__glMade' in window) return;
  const made = [];
  const contexts = [];
  Object.defineProperty(window, '__glMade', { value: made });
  Object.defineProperty(window, '__glContexts', { value: contexts });
  const counter = { draws: 0 };
  Object.defineProperty(window, '__glDraws', { get: () => counter.draws });
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const context = original.call(this, type, ...rest);
    if (context && /webgl/i.test(String(type))) {
      made.push(String(type));
      contexts.push(context);
    }
    return context;
  };
  const count = (proto) => {
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const fn = proto[name];
      if (typeof fn !== 'function') continue;
      proto[name] = function (...args) {
        counter.draws += 1;
        return fn.apply(this, args);
      };
    }
  };
  if (typeof WebGL2RenderingContext !== 'undefined') count(WebGL2RenderingContext.prototype);
  if (typeof WebGLRenderingContext !== 'undefined') count(WebGLRenderingContext.prototype);
})();`;

export interface Health {
  /** Tolerate messages or URLs that match (a 404 page is expected to log its own 404). */
  allow(pattern: RegExp): void;
  /** What went wrong so far, minus what was allowed. */
  problems(): string[];
}

function watch(context: BrowserContext): Health {
  const found: string[] = [];
  const allowed: RegExp[] = [];
  const origin = new URL(ORIGIN).origin;

  context.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The test browser has no sound card: the page's first chime makes the browser say so.
    if (/AudioContext encountered an error from the audio device/.test(message.text())) return;
    found.push(`console error: ${message.text()}`);
  });
  context.on('weberror', (error) => {
    found.push(`page error: ${error.error().message}`);
  });
  context.on('request', (request) => {
    const url = request.url();
    if (!/^https?:/.test(url)) return;
    if (new URL(url).origin !== origin) found.push(`third-party request: ${url}`);
  });
  context.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    // Navigating away cancels what was in flight; that is not a failure of the app.
    if (/ERR_ABORTED|cancelled|NS_BINDING_ABORTED/i.test(reason)) return;
    found.push(`request failed: ${request.url()} (${reason})`);
  });
  context.on('response', (response) => {
    if (response.status() >= 400) found.push(`${response.status()} for ${response.url()}`);
  });

  return {
    allow: (pattern) => void allowed.push(pattern),
    problems: () => found.filter((line) => !allowed.some((pattern) => pattern.test(line))),
  };
}

interface Options {
  /** The fake clock's start. Time flows from there; use `page.clock` to move it. */
  now: string;
  /** Real (software) WebGL. Off by default: the world falls back to its illustration. */
  webgl: boolean;
}

interface Fixtures {
  health: Health;
}

export const test = base.extend<Options & Fixtures>({
  now: [MORNING, { option: true }],
  webgl: [false, { option: true }],

  context: async ({ context, now, webgl }, provide) => {
    await context.clock.install({ time: new Date(now) });
    await context.addInitScript(webgl ? COUNT_WEBGL : NO_WEBGL);
    await provide(context);
  },

  health: [
    async ({ context }, provide) => {
      const health = watch(context);
      await provide(health);
      expect(health.problems(), 'console errors, page errors and network problems').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens a route and waits until the app has drawn it (the splash is gone, the page frame is in). */
export async function visit(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await ready(page);
}

export async function ready(page: Page): Promise<void> {
  await expect(page.locator('[data-splash]')).toHaveCount(0);
  await expect(page.locator('main').first()).toBeVisible();
}
