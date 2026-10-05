'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

export type SkipLinkProps = Omit<ComponentProps<'a'>, 'children'> & {
  /** The id of the page's `<main>`. */
  targetId?: string;
};

/** The first focusable element on every route: a yellow sticker that appears at the top-left on focus. */
export function SkipLink({ targetId = 'main', className, ...rest }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only -rotate-2 diecut rounded-pill border-3 border-ink bg-yellow px-3 text-body-sm font-bold text-ink dc-4 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-(--z-skip) focus-visible:inline-flex focus-visible:h-8 focus-visible:items-center',
        className,
      )}
      {...rest}
    >
      Skip to content
    </a>
  );
}

export type ProseProps = ComponentProps<'div'> & {
  /** Body metrics instead of reading metrics: coach slips and other chat-sized markdown. */
  compact?: boolean;
};

/** Long-form text and rendered markdown: lessons, methodology, privacy, coach answers. */
export function Prose({ compact = false, className, ...rest }: ProseProps) {
  return <div className={cn('prose-eco prose', compact && 'prose-compact', className)} {...rest} />;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in one plain sentence. */
  description: string;
  /** Verb first, at most three words: "Reset data". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive confirmations are the only place the tomato button appears. */
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/** A yes/no question before something that cannot be undone from a toast. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Keep it',
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
