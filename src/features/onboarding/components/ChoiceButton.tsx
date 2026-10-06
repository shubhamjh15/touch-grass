'use client';

import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type ChoiceButtonProps = Omit<ComponentProps<'button'>, 'children' | 'title'> & {
  title: string;
  detail?: string | null;
  /** The answer already given: tinted, pressed in, with a check. */
  selected?: boolean;
};

/** One big answer: a whole row to tap. Tapping it answers the question and moves on. */
export function ChoiceButton({
  title,
  detail,
  selected = false,
  className,
  ...rest
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'flex min-h-14 w-full hard items-center gap-3 rounded-lg border-2 border-ink px-4 py-2.5 text-left text-ink lift-2',
        selected ? 'bg-yellow-tint' : 'bg-card',
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">{title}</span>
        {detail ? <span className="mt-0.5 block text-body-sm text-ink-3">{detail}</span> : null}
      </span>
      {selected ? (
        <Check size={20} strokeWidth={2.5} aria-hidden="true" className="shrink-0 animate-pop" />
      ) : null}
    </button>
  );
}
