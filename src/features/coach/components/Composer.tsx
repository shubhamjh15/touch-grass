'use client';

import { ArrowUp, Square } from 'lucide-react';
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { IconButton, Textarea } from '@/ui';
import { COACH_COPY } from '../copy';
import { countChars } from '../model/text';

/** One to four lines: the box grows with the text, then scrolls. */
const MAX_LINES = 4;
/** From this share of the limit on, the counter is shown. */
const COUNTER_FROM = 0.8;

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** An answer is arriving: the send button becomes Stop. */
  streaming: boolean;
  maxLength: number;
  /** A short correction under the box ("Type a message first."). */
  problem: string | null;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** The id other surfaces focus (`#coach-composer`). */
  id?: string;
  className?: string;
}

/**
 * The message box. Enter sends, Shift+Enter breaks the line. Typing stays possible while an
 * answer arrives, and the same round button stops it, so focus never has to move.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  maxLength,
  problem,
  inputRef,
  id = 'coach-composer',
  className,
}: ComposerProps) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const hintId = useId();
  const length = countChars(value);
  const over = Math.max(0, length - maxLength);
  const showCounter = length >= maxLength * COUNTER_FROM;

  // The box follows its content, whoever changed it (typing, a quick prompt, a deep link).
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    node.style.height = 'auto';
    const style = getComputedStyle(node);
    const line = Number.parseFloat(style.lineHeight) || 24;
    const frame =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);
    const limit = line * MAX_LINES + (Number.isFinite(frame) ? frame : 0);
    const wanted = node.scrollHeight + (node.offsetHeight - node.clientHeight);
    node.style.height = `${Math.min(wanted, limit)}px`;
    node.style.overflowY = wanted > limit ? 'auto' : 'hidden';
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!streaming) onSend();
  };

  const message = over > 0 ? COACH_COPY.tooLong(over) : problem;

  return (
    <div className={className}>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (streaming) onStop();
          else onSend();
        }}
      >
        <label htmlFor={id} className="sr-only">
          {COACH_COPY.composerLabel}
        </label>
        <Textarea
          id={id}
          ref={(node) => {
            inner.current = node;
            if (typeof inputRef === 'function') inputRef(node);
            else if (inputRef) inputRef.current = node;
          }}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={COACH_COPY.composerPlaceholder}
          invalid={over > 0}
          aria-describedby={hintId}
          enterKeyHint="send"
          autoComplete="off"
          className="min-h-12 flex-1 resize-none py-2.5"
        />
        {streaming ? (
          <IconButton type="submit" label={COACH_COPY.stop} icon={Square} variant="neutral" />
        ) : (
          <IconButton type="submit" label={COACH_COPY.send} icon={ArrowUp} variant="primary" />
        )}
      </form>
      <div id={hintId} className="mt-1.5 flex items-start justify-between gap-3">
        <p
          role={message ? 'alert' : undefined}
          className={cn('text-caption', message ? 'font-semibold text-tomato-deep' : 'text-ink-3')}
        >
          {message ?? COACH_COPY.composerHint}
        </p>
        {showCounter ? (
          <p
            className={cn(
              'shrink-0 font-mono text-data-sm',
              over > 0 ? 'font-semibold text-tomato-deep' : 'text-ink-3',
            )}
          >
            <span className="sr-only">Characters: </span>
            {formatNumber(length)}/{formatNumber(maxLength)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
