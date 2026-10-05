#!/usr/bin/env node
/**
 * Regenerates scripts/fixtures/*.json by playing the real game engine.
 *
 *   node scripts/build-fixtures.mjs [--date YYYY-MM-DD]
 *
 * The work happens in build-fixtures.ts; this wrapper only runs it through vite-node
 * with the project's test configuration, so `@/` imports and TypeScript resolve.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', 'vite-node', 'vite-node.mjs');
const result = spawnSync(
  process.execPath,
  [cli, '-c', 'vitest.config.ts', 'scripts/build-fixtures.ts', '--', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
