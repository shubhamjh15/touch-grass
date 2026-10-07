// Prints, per route, what the browser downloads for the first paint of a production build:
// the HTML, the scripts and stylesheets the HTML references, raw and gzipped.
// Usage: node scripts/measure-build.mjs [distDir]   (default .next-check)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? '.next-check';
const appDir = join(dist, 'server', 'app');

function htmlFiles(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'api' || name === 'dev' || name.endsWith('.segments')) continue;
      out.push(...htmlFiles(full, `${prefix}/${name}`));
    } else if (name.endsWith('.html')) {
      out.push({
        route: `${prefix}/${name.replace(/\.html$/, '')}`.replace(/\/index$/, '/') || '/',
        file: full,
      });
    }
  }
  return out;
}

const cache = new Map();
function sizeOf(url) {
  if (cache.has(url)) return cache.get(url);
  const file = join(dist, url.replace(/^\/_next\//, ''));
  const size = existsSync(file)
    ? (() => {
        const b = readFileSync(file);
        return { raw: b.length, gz: gzipSync(b).length };
      })()
    : { raw: 0, gz: 0 };
  cache.set(url, size);
  return size;
}

const kb = (n) => (n / 1024).toFixed(1).padStart(8);
const rows = [];
for (const { route, file } of htmlFiles(appDir)) {
  const html = readFileSync(file);
  const text = html.toString('utf8');
  const urls = new Set();
  for (const m of text.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) urls.add(m[1]);
  let js = { raw: 0, gz: 0 };
  let css = { raw: 0, gz: 0 };
  for (const u of urls) {
    const s = sizeOf(u.split('?')[0]);
    const target =
      extname(u.split('?')[0]) === '.css' ? css : extname(u.split('?')[0]) === '.js' ? js : null;
    if (target) {
      target.raw += s.raw;
      target.gz += s.gz;
    }
  }
  rows.push({ route, html: html.length, htmlGz: gzipSync(html).length, js, css });
}
rows.sort((a, b) => a.route.localeCompare(b.route));
console.log('route'.padEnd(18), '  html KB  html gz   js KB   js gz  css KB  css gz');
for (const r of rows) {
  console.log(
    r.route.padEnd(18),
    kb(r.html),
    kb(r.htmlGz),
    kb(r.js.raw),
    kb(r.js.gz),
    kb(r.css.raw),
    kb(r.css.gz),
  );
}
let totalRaw = 0;
let totalGz = 0;
const byExt = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const b = readFileSync(full);
      totalRaw += b.length;
      totalGz += gzipSync(b).length;
      const e = extname(name);
      byExt[e] ??= 0;
      byExt[e] += b.length;
    }
  }
})(join(dist, 'static'));
console.log(
  `\nAll of .next/static: ${(totalRaw / 1024 / 1024).toFixed(2)} MB raw, ${(totalGz / 1024 / 1024).toFixed(2)} MB gzip`,
);
console.log(
  Object.entries(byExt)
    .map(([e, n]) => `${e} ${(n / 1024).toFixed(0)} KB`)
    .join(', '),
);
