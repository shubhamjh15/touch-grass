import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_CARRY_KEY,
  clearDemoCarry,
  parseDemoCarry,
  readDemoCarry,
  writeDemoCarry,
} from './demoCarry';

describe('demoCarry', () => {
  it('round-trips a species and the first action through sessionStorage', () => {
    expect(readDemoCarry()).toBeNull();
    expect(writeDemoCarry({ species: 'cherry', actionId: 'plant-based-meal', qty: 1 })).toBe(true);
    expect(readDemoCarry()).toEqual({ species: 'cherry', actionId: 'plant-based-meal', qty: 1 });
    expect(localStorage.length).toBe(0);
    clearDemoCarry();
    expect(sessionStorage.getItem(DEMO_CARRY_KEY)).toBeNull();
  });

  it('carries a species on its own', () => {
    writeDemoCarry({ species: 'pine', actionId: null, qty: null });
    expect(readDemoCarry()).toEqual({ species: 'pine', actionId: null, qty: null });
  });

  it('drops an action it cannot vouch for but keeps the species', () => {
    writeDemoCarry({ species: 'oak', actionId: '<script>', qty: 1 });
    expect(readDemoCarry()).toEqual({ species: 'oak', actionId: null, qty: null });
    writeDemoCarry({ species: 'oak', actionId: 'shorter-shower', qty: Number.NaN });
    expect(readDemoCarry()).toEqual({ species: 'oak', actionId: null, qty: null });
  });

  it.each([
    ['nothing', null],
    ['empty text', ''],
    ['not JSON', '{species:'],
    ['a string', '"oak"'],
    ['null', 'null'],
    ['another version', '{"v":2,"species":"oak","actionId":null,"qty":null}'],
    ['an unknown species', '{"v":1,"species":"baobab","actionId":null,"qty":null}'],
    ['a strange action id', '{"v":1,"species":"oak","actionId":"../../etc","qty":1}'],
    ['a negative quantity', '{"v":1,"species":"oak","actionId":"plant-based-meal","qty":-1}'],
    ['an oversized payload', `{"v":1,"species":"oak","pad":"${'x'.repeat(600)}"}`],
  ])('ignores %s', (_name, raw) => {
    expect(parseDemoCarry(raw)).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDemoCarry()).toBeNull();
    expect(writeDemoCarry({ species: 'oak', actionId: null, qty: null })).toBe(false);
  });
});
