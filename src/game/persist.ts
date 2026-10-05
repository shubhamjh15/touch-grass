/**
 * Reading and writing saved games: schema versions and migrations, the export
 * envelope with its checksum, validated import, and the CSV of logs (product spec
 * section 13.2). A save that cannot be read is never dropped silently: the caller
 * gets the reason and keeps the raw text.
 */
import { sha256Hex } from '@/lib/codec';
import { dayKey } from '@/lib/dates';
import { SCHEMA_VERSION } from './economy';
import { stageIndexOf } from './growth';
import { EXPORT_APP_ID, EXPORT_FILE_PREFIX } from './keys';
import { levelOf } from './levels';
import { validateState, withDefaults } from './schema';
import { checkInvariants } from './state';
import type { GameState } from './types';

/** What the persist layer writes under the game key. */
export interface StoredGame {
  state: GameState;
  version: number;
}

export type LoadFailure = 'not-json' | 'not-a-save' | 'newer-schema' | 'schema' | 'invariants';

export type LoadResult =
  | { ok: true; state: GameState; migratedFrom: number | null }
  | { ok: false; reason: LoadFailure; detail: string };

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * One function per schema version: `MIGRATIONS[n]` turns a version-n state into version
 * n + 1, and a save is walked up one step at a time. Schema 1 is the first released
 * schema, so the table is empty today. Additive fields never need an entry:
 * `withDefaults` fills them in. Renames, removals and changed meanings do.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Brings a parsed state of any known version up to the current schema and validates
 * it. Derived values are never trusted: celebration markers are re-based on the
 * loaded totals so an import does not replay level-ups.
 */
export function loadState(
  input: unknown,
  version: number,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  currentVersion: number = SCHEMA_VERSION,
): LoadResult {
  if (!isObject(input))
    return { ok: false, reason: 'not-a-save', detail: 'The save is not an object.' };
  if (!Number.isInteger(version) || version < 0) {
    return { ok: false, reason: 'not-a-save', detail: 'The save has no schema version.' };
  }
  if (version > currentVersion) {
    return {
      ok: false,
      reason: 'newer-schema',
      detail: `This save is from a newer version of the app (schema ${version}; this build reads up to ${currentVersion}).`,
    };
  }
  let current: Record<string, unknown> = input;
  for (let from = version; from < currentVersion; from += 1) {
    const step = migrations[from];
    if (!step) return { ok: false, reason: 'schema', detail: `No migration from schema ${from}.` };
    current = step(current);
  }
  const checked = validateState(withDefaults(current));
  if (!checked.ok) return { ok: false, reason: 'schema', detail: checked.reason };
  const problems = checkInvariants(checked.state);
  if (problems.length > 0) {
    return { ok: false, reason: 'invariants', detail: problems.slice(0, 3).join('; ') };
  }
  const state = checked.state;
  const seen = {
    ...state.seen,
    maxLevel: Math.max(state.seen.maxLevel, levelOf(state.xp)),
    maxStage: Math.max(state.seen.maxStage, stageIndexOf(state.tree.gp)),
  };
  const rebased =
    seen.maxLevel === state.seen.maxLevel && seen.maxStage === state.seen.maxStage
      ? state
      : { ...state, seen };
  return { ok: true, state: rebased, migratedFrom: version === currentVersion ? null : version };
}

/** Parses what the persist layer stored (`{ state, version }`). */
export function parseStoredGame(raw: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json', detail: 'The save is not valid JSON.' };
  }
  if (!isObject(parsed) || !isObject(parsed.state)) {
    return { ok: false, reason: 'not-a-save', detail: 'The save has no state.' };
  }
  const version =
    typeof parsed.version === 'number'
      ? parsed.version
      : typeof parsed.state.schemaVersion === 'number'
        ? parsed.state.schemaVersion
        : Number.NaN;
  return loadState(parsed.state, version);
}

export function serializeStoredGame(state: GameState): string {
  const stored: StoredGame = { state, version: SCHEMA_VERSION };
  return JSON.stringify(stored);
}

// ── Export and import ───────────────────────────────────────────────────────

export interface ExportEnvelope {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
  appVersion: string;
  state: GameState;
  /** Coach chats, only when the user ticked "Include coach chats". */
  coach: unknown;
  checksum: string;
}

export function checksumOf(state: GameState): string {
  return `sha256:${sha256Hex(JSON.stringify(state))}`;
}

export function buildExport(
  state: GameState,
  now: number,
  options: { appVersion?: string; coach?: unknown } = {},
): ExportEnvelope {
  return {
    app: EXPORT_APP_ID,
    exportedAt: new Date(now).toISOString(),
    appVersion: options.appVersion ?? '2.0.0',
    state,
    coach: options.coach ?? null,
    checksum: checksumOf(state),
  };
}

export function exportFileName(now: number, extension: 'json' | 'csv' = 'json'): string {
  return `${EXPORT_FILE_PREFIX}-${dayKey(now)}.${extension}`;
}

export interface ImportPreview {
  treeName: string;
  species: string;
  rings: number;
  logs: number;
  /** First and last day with a log; `null` when there are none. */
  firstLogDay: string | null;
  lastLogDay: string | null;
  plantedDay: string;
  exportedAt: string | null;
}

export type ImportFailure = 'not-json' | 'wrong-app' | 'newer-schema' | 'schema' | 'invariants';

export const IMPORT_FAILURE_COPY: Readonly<Record<ImportFailure, string>> = {
  'not-json': "This file isn't a save file: it could not be read as JSON.",
  'wrong-app': "This file wasn't exported from this app.",
  'newer-schema': 'This file comes from a newer version of the app. Update first, then import.',
  schema: 'This file is damaged or incomplete.',
  invariants: 'The numbers in this file do not add up, so it was not imported.',
};

export type ImportResult =
  | {
      ok: true;
      state: GameState;
      coach: unknown;
      preview: ImportPreview;
      /** "This file was edited outside the app": the import may still proceed. */
      checksumMismatch: boolean;
    }
  | { ok: false; reason: ImportFailure; message: string; detail: string };

/** Validates an export file without changing anything. A failure names the specific reason. */
export function parseImport(text: string): ImportResult {
  const fail = (reason: ImportFailure, detail: string): ImportResult => ({
    ok: false,
    reason,
    message: IMPORT_FAILURE_COPY[reason],
    detail,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('not-json', 'JSON.parse failed.');
  }
  if (!isObject(parsed) || parsed.app !== EXPORT_APP_ID || !isObject(parsed.state)) {
    return fail('wrong-app', 'Missing or unexpected "app" or "state".');
  }
  const version =
    typeof parsed.state.schemaVersion === 'number' ? parsed.state.schemaVersion : Number.NaN;
  const rawChecksum = `sha256:${sha256Hex(JSON.stringify(parsed.state))}`;
  const loaded = loadState(parsed.state, version);
  if (!loaded.ok) {
    const reason: ImportFailure = loaded.reason === 'not-a-save' ? 'schema' : loaded.reason;
    return fail(reason, loaded.detail);
  }
  const { state } = loaded;
  return {
    ok: true,
    state,
    coach: parsed.coach ?? null,
    preview: {
      treeName: state.profile.treeName,
      species: state.profile.species,
      rings: state.tree.rings,
      logs: state.logs.length,
      firstLogDay: state.logs[0]?.day ?? null,
      lastLogDay: state.logs[state.logs.length - 1]?.day ?? null,
      plantedDay: state.profile.plantedDay,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    },
    checksumMismatch: parsed.checksum !== rawChecksum,
  };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'date',
  'day',
  'action_id',
  'title',
  'category',
  'qty',
  'unit',
  'variant',
  'co2e_kg',
  'kg_low',
  'kg_high',
  'estimate',
  'kind',
  'xp',
  'gp',
  'source',
] as const;

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  // A leading =, +, - or @ would be run as a formula by a spreadsheet.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row per log, oldest first, with a header row. */
export function logsToCsv(state: Pick<GameState, 'logs'>): string {
  const rows = state.logs.map((log) =>
    [
      new Date(log.ts).toISOString(),
      log.day,
      log.actionId,
      log.title,
      log.category,
      log.qty,
      log.unit,
      log.variant,
      log.co2eKg,
      log.kgLow,
      log.kgHigh,
      log.estimate,
      log.kind,
      log.xp,
      log.gp,
      log.source,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n');
}
