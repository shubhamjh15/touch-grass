'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { ROTATE } from './tokens';

const TONE = {
  yellow: 'bg-yellow-tint',
  paper: 'bg-paper',
  blue: 'bg-blue-tint',
  pink: 'bg-pink-tint',
} as const;

const TAPE = {
  pink: 'var(--color-pink)',
  yellow: 'var(--color-yellow)',
  blue: 'var(--color-blue)',
  green: 'var(--color-green)',
} as const;

export type TapeNoteProps = ComponentProps<'div'> & {
  tone?: keyof typeof TONE;
  tape?: keyof typeof TAPE;
  /** Rotated notes hold at most three lines; longer text sits at 0. */
  rotate?: -2 | -1 | 0 | 1 | 2;
  /** Bold inline lead-in, e.g. "Moss says:". */
  author?: string;
};

/** A note held by a strip of washi tape: coach tips, weekly prompts, kind reminders. */
export function TapeNote({
  tone = 'yellow',
  tape = 'pink',
  rotate = -1,
  author,
  className,
  children,
  ...rest
}: TapeNoteProps) {
  return (
    <div
      className={cn(
        'relative rounded-paper border-3 border-ink px-4 pt-5 pb-3 text-label font-medium text-ink shadow-3',
        TONE[tone],
        ROTATE[rotate],
        className,
      )}
      {...rest}
    >
      <i
        className="tape"
        aria-hidden="true"
        style={{ '--tape-color': TAPE[tape] } as CSSProperties}
      />
      <p className="leading-[1.45]">
        {author ? <b className="font-bold">{author} </b> : null}
        {children}
      </p>
    </div>
  );
}
