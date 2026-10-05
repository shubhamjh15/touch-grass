import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Route handlers under app/api and the code in server/ run on the server, never
 * in the browser. They stay self-contained: plain relative imports (the bundler
 * resolves them), no "@/" alias, and the only thing allowed to come from src/ is
 * the dependency-free AI contract. These checks guard every server file.
 */
const root = process.cwd();

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    const deployed =
      entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && entry.name !== 'testkit.ts';
    return deployed ? [path] : [];
  });
}

const files = [...sources('app/api'), ...sources('server')];
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;

describe('server-side files', () => {
  it('finds the files it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('keeps app/api to the three endpoints, so nothing else is exposed as a route', () => {
    expect(readdirSync(join(root, 'app/api')).sort()).toEqual(['chat', 'estimate', 'status']);
  });

  it.each(files)('%s uses plain relative imports and no alias', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const target = match[1] ?? '';
      expect(target.startsWith('@/'), `${file} imports ${target}`).toBe(false);
      if (target.startsWith('.'))
        expect(/\.(js|ts)$/.test(target), `${file} imports ${target}`).toBe(false);
    }
  });

  it.each(files)('%s reaches into src/ only for the AI contract', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const target = match[1] ?? '';
      if (/(^|\/)src\//.test(target)) expect(target).toMatch(/src\/ai\/contract$/);
    }
  });

  it.each(files)('%s touches no browser-only API', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    expect(text).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator)\./);
  });
});
