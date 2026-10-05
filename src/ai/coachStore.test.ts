import { describe, expect, it, vi } from 'vitest';
import {
  MAX_STORED_MESSAGES,
  STORE_VERSION,
  createCoachStore,
  safeStorage,
  sanitizeMessages,
  type CoachMessage,
} from './coachStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => void data.set(name, value),
    removeItem: (name: string) => void data.delete(name),
    data,
  };
}

const message = (id: string, patch: Partial<CoachMessage> = {}): CoachMessage => ({
  id,
  role: 'user',
  content: `message ${id}`,
  createdAt: 1_700_000_000_000,
  status: 'complete',
  ...patch,
});

const saved = (messages: unknown, version = STORE_VERSION): string =>
  JSON.stringify({ state: { messages }, version });

describe('persistence', () => {
  it('saves only the conversation, never the transient state', () => {
    const storage = memoryStorage();
    const store = createCoachStore({ storage, name: 'k' });
    store.getState().append(message('a'));
    store.getState().setStreaming(true);
    store.getState().setLive({ configured: true, provider: 'Groq' });
    store.getState().setNotice({ id: 'n', kind: 'offline', text: 'x' });
    const persisted = JSON.parse(storage.data.get('k') ?? '{}') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(persisted.version).toBe(STORE_VERSION);
    expect(Object.keys(persisted.state)).toEqual(['messages']);
    expect(JSON.stringify(persisted)).not.toContain('Groq');
  });

  it('caps the history, dropping the oldest', () => {
    const store = createCoachStore({ storage: memoryStorage(), name: 'k' });
    for (let i = 0; i < MAX_STORED_MESSAGES + 15; i += 1) store.getState().append(message(`m${i}`));
    const { messages } = store.getState();
    expect(messages).toHaveLength(MAX_STORED_MESSAGES);
    expect(messages[0]?.id).toBe('m15');
    expect(messages.at(-1)?.id).toBe(`m${MAX_STORED_MESSAGES + 14}`);
  });

  it('restores a saved conversation', () => {
    const storage = memoryStorage({
      k: saved([
        message('a'),
        message('b', { role: 'assistant', source: 'live', provider: 'Groq' }),
      ]),
    });
    const store = createCoachStore({ storage, name: 'k' });
    expect(store.getState().messages.map((m) => m.id)).toEqual(['a', 'b']);
    expect(store.getState().messages[1]).toMatchObject({ source: 'live', provider: 'Groq' });
    expect(store.getState().isStreaming).toBe(false);
  });

  it('turns an answer that was mid-stream into a stopped one, and drops an empty one', () => {
    const storage = memoryStorage({
      k: saved([
        message('u'),
        message('a1', { role: 'assistant', status: 'streaming', content: 'Half an ans' }),
        message('u2'),
        message('a2', { role: 'assistant', status: 'streaming', content: '' }),
      ]),
    });
    const store = createCoachStore({ storage, name: 'k' });
    expect(store.getState().messages.map((m) => [m.id, m.status])).toEqual([
      ['u', 'complete'],
      ['a1', 'stopped'],
      ['u2', 'complete'],
    ]);
  });

  it('survives corrupt, hostile and mis-versioned data', () => {
    for (const raw of [
      'not json',
      '{}',
      '{"state":null,"version":1}',
      saved('nope'),
      saved([null, 1, 'x', { id: 5 }, { id: 'a', role: 'system', content: 'x', createdAt: 1 }]),
      saved([message('ok')], 0),
      saved([message('ok')], 99),
    ]) {
      const store = createCoachStore({ storage: memoryStorage({ k: raw }), name: 'k' });
      expect(Array.isArray(store.getState().messages)).toBe(true);
    }
    const migrated = createCoachStore({
      storage: memoryStorage({ k: saved([message('ok')], 0) }),
      name: 'k',
    });
    expect(migrated.getState().messages.map((m) => m.id)).toEqual(['ok']);
  });

  it('clips oversized content and ignores unknown fields', () => {
    const result = sanitizeMessages([
      {
        ...message('a'),
        content: 'x'.repeat(10_000),
        __proto__: { evil: true },
        extra: 'ignored',
        provider: 'p'.repeat(500),
      },
    ]);
    expect(result[0]?.content.length).toBe(4000);
    expect(result[0]?.provider?.length).toBe(60);
    expect(result[0]).not.toHaveProperty('extra');
  });

  it('clear empties the history and the notice', () => {
    const store = createCoachStore({ storage: memoryStorage(), name: 'k' });
    store.getState().append(message('a'));
    store.getState().setNotice({ id: 'n', kind: 'offline', text: 'x' });
    store.getState().clear();
    expect(store.getState().messages).toEqual([]);
    expect(store.getState().notice).toBeNull();
  });

  it('patch, remove and removeAfter work on ids', () => {
    const store = createCoachStore({ storage: memoryStorage(), name: 'k' });
    for (const id of ['a', 'b', 'c']) store.getState().append(message(id));
    store.getState().patch('b', { content: 'changed' });
    expect(store.getState().messages[1]?.content).toBe('changed');
    store.getState().remove('c');
    expect(store.getState().messages.map((m) => m.id)).toEqual(['a', 'b']);
    store.getState().append(message('d'));
    store.getState().removeAfter('a');
    expect(store.getState().messages.map((m) => m.id)).toEqual(['a']);
    store.getState().removeAfter('missing');
    expect(store.getState().messages).toHaveLength(1);
  });

  it('remembers that a notice was shown even after it is dismissed', () => {
    const store = createCoachStore({ storage: memoryStorage(), name: 'k' });
    expect(store.getState().noticeShown).toBe(false);
    store.getState().setNotice({ id: 'n', kind: 'offline', text: 'x' });
    store.getState().setNotice(null);
    expect(store.getState().noticeShown).toBe(true);
  });
});

describe('safeStorage', () => {
  it('falls back to memory when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const storage = safeStorage();
    expect(() => storage.setItem('a', '1')).not.toThrow();
    expect(storage.getItem('a')).toBe('1');
    expect(() => storage.removeItem('a')).not.toThrow();
    spy.mockRestore();
    getSpy.mockRestore();
  });

  it('round-trips through real localStorage', () => {
    const storage = safeStorage();
    storage.setItem('ecoquest-test', 'x');
    expect(localStorage.getItem('ecoquest-test')).toBe('x');
    storage.removeItem('ecoquest-test');
    expect(localStorage.getItem('ecoquest-test')).toBeNull();
  });
});
