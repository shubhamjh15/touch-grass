/**
 * A storage seam that never throws. Browsers can refuse storage (private windows,
 * blocked site data, a full quota) and the server has none at all; the game must keep
 * working in memory in every one of those cases and say so.
 */
import { SANDBOX_MARK_KEY, SANDBOX_PREFIX, STORAGE_KEYS, STORAGE_PREFIX } from './keys';
import { LEGACY_KEYS } from './legacy';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Every key currently stored. */
  keys(): string[];
}

/** `local`: the browser's storage. `memory`: nothing survives a reload. */
export type StorageMode = 'local' | 'memory';

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
  };
}

function wrapWebStorage(storage: Storage): KeyValueStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
    keys: () =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '').filter(
        Boolean,
      ),
  };
}

/** The browser's localStorage when it exists and accepts a write; otherwise memory. */
export function detectStorage(): { storage: KeyValueStorage; mode: StorageMode } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = `${STORAGE_PREFIX}probe`;
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return { storage: wrapWebStorage(window.localStorage), mode: 'local' };
    }
  } catch {
    // Private mode or blocked site data: fall through to memory.
  }
  return { storage: createMemoryStorage(), mode: 'memory' };
}

/** The tab's sessionStorage when it exists and accepts a write; otherwise memory. */
export function detectSessionStorage(): KeyValueStorage {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const probe = `${STORAGE_PREFIX}probe`;
      window.sessionStorage.setItem(probe, '1');
      window.sessionStorage.removeItem(probe);
      return wrapWebStorage(window.sessionStorage);
    }
  } catch {
    // Private mode or blocked site data: a sandbox then lives in memory.
  }
  return createMemoryStorage();
}

/**
 * A storage of its own inside another one: every key is kept behind `prefix`, and only
 * those keys are listed. Whatever uses the view cannot see or touch anything else.
 */
export function createNamespacedStorage(base: KeyValueStorage, prefix: string): KeyValueStorage {
  return {
    getItem: (key) => base.getItem(prefix + key),
    setItem: (key, value) => base.setItem(prefix + key, value),
    removeItem: (key) => base.removeItem(prefix + key),
    keys: () =>
      base
        .keys()
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
  };
}

/**
 * Where a sandbox lives: a namespaced view for its stand-in save, and a flag that says
 * this tab is showing one. The flag and the clean-up never throw.
 */
export interface SandboxStorage {
  view: KeyValueStorage;
  isMarked: () => boolean;
  mark: () => void;
  /** Removes the flag and everything the sandbox stored. */
  clear: () => void;
}

export function createSandboxStorage(base: KeyValueStorage): SandboxStorage {
  const view = createNamespacedStorage(base, SANDBOX_PREFIX);
  return {
    view,
    isMarked() {
      try {
        return base.getItem(SANDBOX_MARK_KEY) === '1';
      } catch {
        return false;
      }
    },
    mark() {
      try {
        base.setItem(SANDBOX_MARK_KEY, '1');
      } catch {
        // Without the flag the sandbox still works; it just does not survive a reload.
      }
    },
    clear() {
      try {
        base.removeItem(SANDBOX_MARK_KEY);
        for (const key of view.keys()) view.removeItem(key);
      } catch {
        // Nothing stored, nothing to clear.
      }
    },
  };
}

export interface RecoveryEntry {
  savedAt: number;
  reason: string;
  detail: string;
  raw: string;
}

const MAX_RECOVERY_ENTRIES = 3;

/** Saves that could not be read, newest first. */
export function readRecovery(storage: KeyValueStorage): RecoveryEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEYS.recovery) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecoveryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecoveryEntry).raw === 'string' &&
        typeof (entry as RecoveryEntry).savedAt === 'number',
    );
  } catch {
    return [];
  }
}

/** Keeps the raw text of an unreadable save so the user can download it or try an import. */
export function keepForRecovery(storage: KeyValueStorage, entry: RecoveryEntry): boolean {
  try {
    const existing = readRecovery(storage).filter((item) => item.raw !== entry.raw);
    storage.setItem(
      STORAGE_KEYS.recovery,
      JSON.stringify([entry, ...existing].slice(0, MAX_RECOVERY_ENTRIES)),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearRecovery(storage: KeyValueStorage): void {
  try {
    storage.removeItem(STORAGE_KEYS.recovery);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Removes everything the app stored, and the legacy app's keys. Used by "Reset". */
export function clearAllAppStorage(storage: KeyValueStorage): void {
  try {
    for (const key of storage.keys()) {
      if (key.startsWith(STORAGE_PREFIX) || (LEGACY_KEYS as readonly string[]).includes(key)) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Storage that cannot be listed has nothing we can remove.
  }
}

/** Bytes the app occupies in storage (UTF-16, two bytes per character), for "storage used". */
export function storageUsedBytes(storage: KeyValueStorage): number {
  try {
    let chars = 0;
    for (const key of storage.keys()) {
      if (key.startsWith(STORAGE_PREFIX)) chars += key.length + (storage.getItem(key)?.length ?? 0);
    }
    return chars * 2;
  } catch {
    return 0;
  }
}
