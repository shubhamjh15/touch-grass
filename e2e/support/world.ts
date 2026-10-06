import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * Looking at the 3D world from outside: which chunk holds three.js, what the page asked
 * for, how many contexts it made and how often it drew. The test fixture's init script
 * (`webgl: true`) does the counting inside the page.
 */

const CHUNKS = path.resolve(process.cwd(), '.next-e2e', 'static', 'chunks');

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

let cached: string[] | null = null;

/** File names of the built chunks that contain the three.js renderer. */
export function sceneChunks(): string[] {
  cached ??= walk(CHUNKS)
    .filter((file) => file.endsWith('.js'))
    .filter((file) => readFileSync(file, 'utf8').includes('WebGLRenderer'))
    .map((file) => path.basename(file));
  if (cached.length === 0) throw new Error('no built chunk contains three.js: is .next-e2e built?');
  return cached;
}

/** Records the URLs the page requests, so a spec can ask whether the 3D chunk was among them. */
export function recordRequests(page: Page): { urls: string[]; sceneRequested: () => boolean } {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  const names = sceneChunks();
  return {
    urls,
    sceneRequested: () => urls.some((url) => names.some((name) => url.includes(name))),
  };
}

/** Contexts the page created that are still alive (a probe is lost at once). */
export async function liveContexts(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      ((window as unknown as { __glContexts?: WebGLRenderingContext[] }).__glContexts ?? []).filter(
        (gl) => !gl.isContextLost(),
      ).length,
  );
}

export async function contextsEverMade(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __glMade?: string[] }).__glMade?.length ?? 0);
}

export async function drawCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __glDraws?: number }).__glDraws ?? 0);
}

/** Draw calls made in `ms` of the page's own time. */
export async function drawsWithin(page: Page, ms: number): Promise<number> {
  const before = await drawCalls(page);
  await page.evaluate((wait) => new Promise<void>((resolve) => setTimeout(resolve, wait)), ms);
  return (await drawCalls(page)) - before;
}

export const worldState = (page: Page) => page.locator('html');

/** Waits for the scene's first frame (the app mirrors its state on the document element). */
export async function sceneReady(page: Page): Promise<void> {
  await expect(worldState(page)).toHaveAttribute('data-world', 'ready', { timeout: 90_000 });
}
