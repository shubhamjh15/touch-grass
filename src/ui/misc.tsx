'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

export type ProseProps = ComponentProps<'div'> & {
  /** Body metrics instead of reading metrics: coach slips and other chat-sized markdown. */
  compact?: boolean;
};

/** Long-form text and rendered markdown: lessons, methodology, privacy, coach answers. */
export function Prose({ compact = false, className, ...rest }: ProseProps) {
  return <div className={cn('prose-eco prose', compact && 'prose-compact', className)} {...rest} />;
}

/** The block caret at the end of a message that is still streaming. Decorative. */
export function StreamCaret({ className, ...rest }: Omit<ComponentProps<'span'>, 'children'>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'ml-0.5 inline-block h-[1em] w-[0.55em] animate-caret bg-ink align-[-0.12em]',
        className,
      )}
      {...rest}
    />
  );
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
