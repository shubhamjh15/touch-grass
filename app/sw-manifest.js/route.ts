import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { LESSON_IDS } from '@/data/lessons';

/** Runs once, while the production build prerenders: the list is that build's own files. */
export const dynamic = 'force-static';

const DIST_DIR = process.env.NEXT_DIST_DIR || '.next';

/** Every page a visitor can open. The app's pages are an empty shell that fills in from saved data. */
const PAGES = [
  '/',
  '/start',
  '/today',
  '/log',
  '/quests',
  '/learn',
  '/impact',
  '/community',
  '/coach',
  '/me',
  '/methodology',
  '/privacy',
  '/demo',
  '/_not-found',
];

const PUBLIC_FILES = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

/** Script, style and font files the build emitted, as URLs. */
function staticFiles(dir: string, urlBase: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const url = posix.join(urlBase, name);
    if (statSync(full).isDirectory()) return staticFiles(full, url);
    return /\.(?:js|css|woff2)$/.test(name) ? [url] : [];
  });
}

export function GET() {
  const assets = staticFiles(join(process.cwd(), DIST_DIR, 'static'), '/_next/static');
  const urls = [
    ...PAGES,
    ...LESSON_IDS.map((id) => `/learn/${id}`),
    ...PUBLIC_FILES,
    ...assets.sort(),
  ];
  const build = { version: new Date().toISOString().replace(/\D/g, '').slice(0, 14), urls };
  return new Response(`self.__TOUCH_GRASS_BUILD=${JSON.stringify(build)};\n`, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
