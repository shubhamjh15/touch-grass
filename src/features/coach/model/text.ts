/**
 * Small, pure text helpers for coach messages: which links an answer may carry, and what a
 * finished answer sounds like when it is read aloud.
 */
import { stripChips } from '@/ai';
import { normalizePath, routeInfo } from '@/app/routes';

/**
 * A link in an answer is followed only when it points at a real page of this app
 * (product spec 8.4). Everything else, including every external address, is shown as
 * plain text. Returns the safe in-app href, or `null`.
 */
export function internalHref(href: string | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  // One leading slash only: "//host" and "/\host" are other origins in disguise.
  if (!/^\/(?![/\\])/.test(value)) return null;
  if (/[\s\\<>"'`]/.test(value) || [...value].some((char) => char.charCodeAt(0) < 32)) return null;
  const path = normalizePath(value);
  if (routeInfo(path).id === 'unknown') return null;
  return value;
}

/** Markdown reduced to the words a person would say. */
export function plainText(markdown: string): string {
  return (
    stripChips(markdown)
      // Links read as their label; images never render, so they read as nothing.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
      .replace(/(\*\*|__|\*|_|~~|`)/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/** The polite announcement for a finished answer: who spoke, what they said, what follows. */
export function announcement(markdown: string, chipCount: number, builtIn: boolean): string {
  const said = plainText(markdown);
  if (said === '') return '';
  const who = builtIn ? 'Moss, built-in answer' : 'Moss';
  const chips =
    chipCount === 0
      ? ''
      : chipCount === 1
        ? ' One suggestion follows.'
        : ` ${chipCount} suggestions follow.`;
  return `${who}: ${said}${chips}`;
}

/** Characters as a person counts them (an emoji is one), matching the server's limit. */
export function countChars(text: string): number {
  return [...text].length;
}
