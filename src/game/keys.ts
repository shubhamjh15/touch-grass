/**
 * Storage keys and the export envelope's app id, in one place so a rename is one edit.
 * Everything the product stores in the browser lives under the same prefix.
 */
export const STORAGE_PREFIX = 'touchgrass:';

export const STORAGE_KEYS = {
  /** The persisted game state. */
  game: `${STORAGE_PREFIX}game`,
  /** Coach chat history (owned by the AI module; read here only for export and reset). */
  coach: `${STORAGE_PREFIX}coach`,
  /** UI conveniences (owned by the shell). */
  ui: `${STORAGE_PREFIX}ui`,
  /** Raw copy of the legacy app's data, kept until the user deletes it. */
  legacyBackup: `${STORAGE_PREFIX}legacy-backup`,
  /** Saves that could not be read, kept so nothing is ever silently wiped. */
  recovery: `${STORAGE_PREFIX}game:recovery`,
} as const;

/**
 * A sandbox (the demo world) keeps its stand-in save in the tab's session storage, under
 * the same key names behind this prefix, so it can never meet the real save.
 */
export const SANDBOX_PREFIX = 'sandbox:';
/** Session-storage flag: this tab is showing a sandbox. Survives a reload, not the tab. */
export const SANDBOX_MARK_KEY = `${STORAGE_PREFIX}sandbox`;

/** `app` field of an export file; an import of anything else is refused. */
export const EXPORT_APP_ID = 'touchgrass';
export const EXPORT_FILE_PREFIX = 'touch-grass';
