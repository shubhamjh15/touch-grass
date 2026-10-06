import { describe, expect, it } from 'vitest';
import { announcement, countChars, internalHref, plainText } from './text';

describe('internalHref', () => {
  it.each(['/log', '/log?a=plant-based-meal&src=coach', '/learn/the-blanket', '/methodology#x'])(
    'follows %s',
    (href) => {
      expect(internalHref(href)).toBe(href);
    },
  );

  it.each([
    'https://example.com',
    'http://localhost:5173/log',
    '//evil.example/log',
    '/\\evil.example',
    'javascript:alert(1)',
    'mailto:someone@example.com',
    '/no-such-page',
    '/learn/a/b',
    '/log"onmouseover="x',
    'log',
    '',
    undefined,
  ])('refuses %s', (href) => {
    expect(internalHref(href)).toBeNull();
  });
});

describe('plainText', () => {
  it('reads markdown as the words a person would say', () => {
    expect(
      plainText('**Short trips** are the _easy_ ones:\n\n- walk\n- [ride](/log)\n\n[[log:x]]'),
    ).toBe('Short trips are the easy ones: walk ride');
  });

  it('drops raw HTML and images', () => {
    expect(plainText('Hi <img src=x onerror=alert(1)> there ![cat](http://x/y.png)')).toBe(
      'Hi there',
    );
  });
});

describe('announcement', () => {
  it('names the speaker and what follows', () => {
    expect(announcement('Easy win: **refill your bottle**.', 1, false)).toBe(
      'Moss: Easy win: refill your bottle. One suggestion follows.',
    );
    expect(announcement('Two ideas.', 2, true)).toBe(
      'Moss, built-in answer: Two ideas. 2 suggestions follow.',
    );
  });

  it('stays silent for an answer with no words', () => {
    expect(announcement('[[break:10]]', 1, false)).toBe('');
  });
});

describe('countChars', () => {
  it('counts an emoji as one character, like the server does', () => {
    expect(countChars('hi 🌱')).toBe(4);
  });
});
