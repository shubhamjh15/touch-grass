'use client';

import { Check, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type ChoiceButtonProps = Omit<ComponentProps<'button'>, 'children' | 'title'> & {
  title: string;
  detail?: string | null;
  /** The answer already given: yellow, pressed in, with a check. */
  selected?: boolean;
  /** A leading glyph for the two big choices of the starting line. */
  icon?: LucideIcon;
  /** Tints the icon tile. */
  tone?: 'blue' | 'white';
};

/**
 * One big answer: a whole row that presses into its shadow. Used for the quiz options
 * (where a tap answers and moves on) and for the take-it-or-skip-it choice.
 */
export function ChoiceButton({
  title,
  detail,
  selected = false,
  icon: Icon,
  tone = 'white',
  className,
  ...rest
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'group/choice flex min-h-14 w-full hard items-center gap-3 rounded-md border-3 border-ink px-3.5 py-2.5 text-left text-ink lift-3',
        selected ? 'bg-yellow' : 'bg-card',
        className,
      )}
      {...rest}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-sm border-2 border-ink',
            tone === 'blue' ? 'bg-blue' : 'bg-white',
          )}
        >
          <Icon size={20} strokeWidth={2.25} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-label">{title}</span>
        {detail ? (
          <span className={cn('mt-1 block text-caption', selected ? 'text-ink' : 'text-ink-3')}>
            {detail}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2',
          selected ? 'border-ink bg-white' : 'border-dashed border-ink-4',
        )}
      >
        {selected ? <Check size={14} strokeWidth={3.25} className="animate-pop" /> : null}
      </span>
    </button>
  );
}
