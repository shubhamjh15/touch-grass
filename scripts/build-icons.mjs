#!/usr/bin/env node
/**
 * Rasterises the app icons from their SVG sources with the Playwright browser that is already
 * installed for the screenshot and smoke tests, so the repo needs no image toolchain.
 *
 *   node scripts/build-icons.mjs
 *
 * Sources:  public/icon.svg           the logo tile on a transparent ground
 *           public/icon-maskable.svg  the leaf on a full-bleed green square (safe zone 80 %)
 * Output:   public/icons/*.png        referenced by app/manifest.ts and app/layout.tsx
 *
 * Re-run it whenever a source changes and commit the PNGs.
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, 'icons');

/** iOS draws the touch icon on black when it has transparency, so that one is always opaque. */
const TARGETS = [
  { source: 'icon.svg', size: 192, file: 'icon-192.png' },
  { source: 'icon.svg', size: 512, file: 'icon-512.png' },
  { source: 'icon-maskable.svg', size: 192, file: 'maskable-192.png' },
  { source: 'icon-maskable.svg', size: 512, file: 'maskable-512.png' },
  { source: 'icon-maskable.svg', size: 180, file: 'apple-touch-icon.png' },
  { source: 'icon.svg', size: 48, file: 'favicon-48.png' },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const target of TARGETS) {
    const svg = readFileSync(path.join(publicDir, target.source));
    const data = `data:image/svg+xml;base64,${svg.toString('base64')}`;
    await page.setViewportSize({ width: target.size, height: target.size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">` +
        `<img alt="" src="${data}" width="${target.size}" height="${target.size}" style="display:block">` +
        `</body></html>`,
    );
    await page.waitForFunction(() => {
      const image = document.querySelector('img');
      return Boolean(image && image.complete && image.naturalWidth > 0);
    });
    const file = path.join(outDir, target.file);
    await page.screenshot({ path: file, omitBackground: true, type: 'png' });
    console.log(`${target.file}  ${target.size}x${target.size}  ${statSync(file).size} bytes`);
  }
} finally {
  await browser.close();
}
