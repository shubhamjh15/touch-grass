import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Files under api/ and server/ run on Vercel's Node ESM runtime, not in Vite:
 * relative imports need explicit ".js" extensions, the "@/" alias does not
 * exist there, and the only thing allowed to come from src/ is the
 * dependency-free AI contract. These checks guard every deployed file.
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

const files = [...sources('api'), ...sources('server')];
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;

describe('deployed function files', () => {
  it('finds the files it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('keeps api/ to the three endpoints, so nothing else is deployed as a function', () => {
    expect(readdirSync(join(root, 'api')).sort()).toEqual(['chat.ts', 'estimate.ts', 'status.ts']);
  });

  it.each(files)('%s uses only explicit .js relative imports and no alias', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const target = match[1] ?? '';
      expect(target.startsWith('@/'), `${file} imports ${target}`).toBe(false);
      if (target.startsWith('.'))
        expect(target.endsWith('.js'), `${file} imports ${target}`).toBe(true);
    }
  });

  it.each(files)('%s reaches into src/ only for the AI contract', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const target = match[1] ?? '';
      if (/(^|\/)src\//.test(target)) expect(target).toMatch(/src\/ai\/contract\.js$/);
    }
  });

  it.each(files)('%s touches no browser-only API', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    expect(text).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator)\./);
  });
});
