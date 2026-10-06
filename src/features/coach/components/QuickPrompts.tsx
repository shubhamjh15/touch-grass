'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { QUICK_PROMPTS, type QuickPrompt } from '@/ai';
import { cn } from '@/lib/cn';
import { Chip } from '@/ui';
import { useCoachUi } from '../coachUi';
import { COACH_COPY } from '../copy';

export interface QuickPromptsProps {
  /** Sends the prompt as the user's own message. */
  onPick: (prompt: QuickPrompt) => void;
  /** An answer is arriving: the chips stay focusable but do nothing. */
  busy: boolean;
  className?: string;
}

/**
 * Three ideas above the box, five more behind "More ideas" (product spec 8.6). One row that
 * scrolls sideways on phones and wraps on desktop, so nothing is cut off.
 */
export function QuickPrompts({ onPick, busy, className }: QuickPromptsProps) {
  const more = useCoachUi((state) => state.moreIdeas);
  const setMore = useCoachUi((state) => state.setMoreIdeas);
  const prompts = more ? [...QUICK_PROMPTS.primary, ...QUICK_PROMPTS.more] : QUICK_PROMPTS.primary;

  return (
    <div
      role="group"
      aria-label={COACH_COPY.promptsLabel}
      className={cn('scroll-row flex gap-2 py-1.5 lg:flex-wrap', className)}
    >
      {prompts.map((prompt) => (
        <Chip
          key={prompt.id}
          aria-pressed={undefined}
          aria-disabled={busy || undefined}
          className={cn(busy && 'cursor-not-allowed text-ink-3')}
          onClick={() => {
            if (!busy) onPick(prompt);
          }}
        >
          {prompt.label}
        </Chip>
      ))}
      <Chip
        aria-pressed={undefined}
        aria-expanded={more}
        icon={more ? ChevronUp : ChevronDown}
        className="bg-mat"
        onClick={() => setMore(!more)}
      >
        {more ? COACH_COPY.fewerIdeas : COACH_COPY.moreIdeas}
      </Chip>
    </div>
  );
}
