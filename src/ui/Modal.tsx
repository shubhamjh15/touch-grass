'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { IconButton } from './IconButton';
import { Sheet } from './Sheet';
import { useFocusReturn } from './useFocusReturn';

const WIDTH = {
  sm: '[--w:420px]',
  md: '[--w:520px]',
  lg: '[--w:720px]',
} as const;

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled convenience: an element that opens the modal. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  size?: keyof typeof WIDTH;
  /** Actions, right-aligned, primary last. Stacked full-width in the sheet form. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * A dialog pressed onto the page over the halftone scrim. Focus is trapped and returns to the
 * trigger; Esc closes. Below `md` every Modal renders as a bottom Sheet.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  size = 'md',
  footer,
  className,
  children,
}: ModalProps) {
  const wide = useBreakpoint('md');
  const focusReturn = useFocusReturn();

  if (!wide) {
    return (
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        trigger={trigger}
        title={title}
        description={description}
        // A sheet stacks its actions with the primary first; a modal's footer lists it last.
        footer={footer ? <div className="flex flex-col-reverse gap-2.5">{footer}</div> : undefined}
        className={className}
      >
        {children}
      </Sheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal-scrim) scrim data-[state=closed]:animate-scrim-out data-[state=open]:animate-scrim-in" />
        <Dialog.Content
          {...focusReturn}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed top-1/2 left-1/2 z-(--z-modal) max-h-[88dvh] w-[min(100vw-32px,var(--w))] -translate-x-1/2 -translate-y-1/2 overflow-auto overscroll-contain rounded-xl border-4 border-ink bg-card p-6 text-ink shadow-5 outline-hidden data-[state=closed]:animate-peel data-[state=open]:animate-stick',
            WIDTH[size],
            className,
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-h3">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 text-body-sm text-ink-2">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" icon={X} size="sm" tooltipSide={null} />
            </Dialog.Close>
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
