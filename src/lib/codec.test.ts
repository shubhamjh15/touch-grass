import { describe, expect, it } from 'vitest';
import { crc32, fromBase64Url, sha256Hex, toBase64Url } from './codec';

describe('base64url', () => {
  it('round-trips UTF-8 text of every length', () => {
    for (const text of [
      '',
      'a',
      'ab',
      'abc',
      'abcd',
      'Loser cooks dinner',
      '🌱 Fern — ≈ 48 kg',
      'ü'.repeat(31),
    ]) {
      const encoded = toBase64Url(text);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(fromBase64Url(encoded)).toBe(text);
    }
  });

  it('matches the standard encoding', () => {
    expect(toBase64Url('hello')).toBe('aGVsbG8');
    expect(toBase64Url('??>>')).toBe('Pz8-Pg');
    expect(toBase64Url('{"v":1}')).toBe('eyJ2IjoxfQ');
  });

  it('rejects anything that is not base64url', () => {
    expect(fromBase64Url('a')).toBeNull();
    expect(fromBase64Url('aGVs bG8')).toBeNull();
    expect(fromBase64Url('aGVsbG8=')).toBeNull();
    expect(fromBase64Url('____')).toBeNull();
  });
});

describe('crc32', () => {
  it('matches the reference check values', () => {
    expect(crc32('')).toBe(0);
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe(0x414fa339);
  });

  it('notices a single changed character', () => {
    expect(crc32('{"k":"rings_5","d":7}')).not.toBe(crc32('{"k":"rings_5","d":8}'));
  });
});

describe('sha256Hex', () => {
  it('matches the published test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('handles text longer than one block and non-ASCII input', () => {
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
    expect(sha256Hex('🌱')).toHaveLength(64);
    expect(sha256Hex('🌱')).not.toBe(sha256Hex('🌿'));
  });
});
