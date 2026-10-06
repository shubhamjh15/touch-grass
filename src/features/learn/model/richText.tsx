import { Fragment, type ReactNode } from 'react';
import { Approx, Co2e } from '@/ui';

/**
 * Lesson text is stored as plain strings. The self-hosted fonts lack a few glyphs the content
 * needs, so this turns them into drawn ones at render time: "≈" becomes the drawn approx mark,
 * "→" a drawn arrow, "CO2e" a unit with a real subscript, and "___" a blank to fill in.
 */

/** Straight quotes and apostrophes become typographic ones. */
export function curlyQuotes(text: string): string {
  return text
    .replace(/(^|[\s([{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}

const TOKEN = /(≈\s*|\s*→\s*|___|CO2e?)/g;

function arrow(key: number): ReactNode {
  return (
    <svg
      key={key}
      viewBox="0 0 20 14"
      aria-hidden="true"
      focusable="false"
      className="mx-[0.3em] inline-block h-[0.44em] w-[0.7em] overflow-visible align-[0.12em]"
    >
      <path
        d="M2 7h15M12 2l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Renders one piece of lesson text with its drawn glyphs. Safe to nest inside any inline element. */
export function richText(text: string): ReactNode {
  const parts = curlyQuotes(text).split(TOKEN);
  return parts.map((part, index) => {
    if (part === '') return null;
    if (/^≈\s*$/.test(part)) return <Approx key={index} weight="mono" />;
    if (/^\s*→\s*$/.test(part)) return arrow(index);
    if (part === '___') {
      return (
        <Fragment key={index}>
          <span
            aria-hidden="true"
            className="mx-0.5 inline-block h-[1em] w-[2.4em] translate-y-[0.12em] border-b-3 border-ink"
          />
          <span className="sr-only">blank</span>
        </Fragment>
      );
    }
    if (part === 'CO2e') return <Co2e key={index} />;
    if (part === 'CO2') {
      return (
        <Fragment key={index}>
          CO<sub>2</sub>
        </Fragment>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** What a screen reader or a live region should hear for the same text: the glyphs spelled out. */
export function plainText(text: string): string {
  return curlyQuotes(text)
    .replace(/≈\s*/g, 'about ')
    .replace(/\s*→\s*/g, ' to ')
    .replace(/___/g, 'blank')
    .replace(/\s+/g, ' ')
    .trim();
}
