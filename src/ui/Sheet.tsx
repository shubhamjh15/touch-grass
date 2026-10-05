'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
import { useFocusReturn } from './useFocusReturn';

/** Fraction of the sheet's height past which letting go closes it. */
const CLOSE_FRACTION = 0.35;
/** Downward speed (px/s) that closes it regardless of distance. */
const CLOSE_VELOCITY = 500;

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled convenience: an element that opens the sheet. */
  trigger?: ReactNode;
  side?: 'bottom' | 'right';
  title: string;
  /** Keeps the title for assistive tech but hides the visual header text. */
  hideTitle?: boolean;
  description?: string;
  /** `false` (the coach on desktop): no scrim, no focus trap; Esc closes and F6 moves between page and drawer. */
  modal?: boolean;
  /** Bottom sheets only: fill the available height (the palette and the coach below `lg`). */
  tall?: boolean;
  /** Content between the title and the close button (a status Tag, an info button). */
  headerExtra?: ReactNode;
  /** Actions. Bottom: stacked full-width, primary first. Right: a row, primary last. */
  footer?: ReactNode;
  /** Classes for the scrolling body. */
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A bottom sheet (mobile) or a right-hand drawer (desktop), on Radix Dialog: focus is trapped and
 * returned, Esc closes. The bottom sheet can also be dragged down by its header; the close button
 * is always there, so dragging is never the only way.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  side = 'bottom',
  title,
  hideTitle = false,
  description,
  modal = true,
  tall = false,
  headerExtra,
  footer,
  bodyClassName,
  className,
  children,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(
    null,
  );
  const pageFocus = useRef<HTMLElement | null>(null);
  const focusReturn = useFocusReturn();

  // F6 moves focus between the page and a non-modal drawer.
  useEffect(() => {
    if (modal || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F6') return;
      const content = contentRef.current;
      if (!content) return;
      event.preventDefault();
      const active = document.activeElement;
      if (active instanceof HTMLElement && content.contains(active)) {
        (pageFocus.current ?? document.querySelector<HTMLElement>('main, [role="main"]'))?.focus();
      } else {
        pageFocus.current = active instanceof HTMLElement ? active : null;
        content.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modal, open]);

  const setOffset = (offset: number, animate: boolean) => {
    const node = contentRef.current;
    if (!node) return;
    node.style.transition = animate ? 'translate var(--dur-base) var(--ease-out)' : 'none';
    // `translate` composes with the enter/exit keyframes, which own `transform`.
    node.style.translate = offset === 0 ? '' : `0 ${offset}px`;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (side !== 'bottom') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (
      event.target instanceof Element &&
      event.target.closest('button, a, input, [role="button"]')
    )
      return;
    drag.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const elapsed = event.timeStamp - current.lastTime;
    if (elapsed > 0) current.velocity = ((event.clientY - current.lastY) / elapsed) * 1000;
    current.lastY = event.clientY;
    current.lastTime = event.timeStamp;
    setOffset(Math.max(0, event.clientY - current.startY), false);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    const distance = Math.max(0, event.clientY - current.startY);
    const height = contentRef.current?.offsetHeight ?? 0;
    if (distance > 0 && (distance > height * CLOSE_FRACTION || current.velocity > CLOSE_VELOCITY)) {
      onOpenChange?.(false);
      if (open === undefined) setOffset(0, true);
    } else {
      setOffset(0, true);
    }
  };

  const bottom = side === 'bottom';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        {modal ? (
          <Dialog.Overlay className="fixed inset-0 z-(--z-scrim) scrim data-[state=closed]:animate-scrim-out data-[state=open]:animate-scrim-in" />
        ) : null}
        <Dialog.Content
          ref={contentRef}
          {...focusReturn}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onInteractOutside={modal ? undefined : (event) => event.preventDefault()}
          className={cn(
            'fixed z-(--z-drawer) flex flex-col overscroll-contain bg-card text-ink outline-hidden',
            bottom
              ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t-4 border-ink data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in md:mx-auto md:w-[min(100vw-32px,560px)] md:border-x-4'
              : 'top-4 right-4 bottom-4 w-[min(420px,100vw-32px)] rounded-xl border-4 border-ink shadow-5 data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in',
            bottom && tall && 'h-[88dvh]',
            className,
          )}
        >
          <div
            className={cn(
              'shrink-0 px-4',
              bottom && 'cursor-grab touch-none active:cursor-grabbing',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            {bottom ? (
              <div aria-hidden="true" className="mx-auto mt-2 h-[5px] w-10 rounded-pill bg-ink" />
            ) : null}
            <div className={cn('flex min-h-12 items-center gap-2', bottom ? 'pt-1' : 'pt-3')}>
              <Dialog.Title
                className={cn('min-w-0 flex-1 truncate text-h3', hideTitle && 'sr-only')}
              >
                {title}
              </Dialog.Title>
              {hideTitle ? <span className="flex-1" /> : null}
              {headerExtra}
              <Dialog.Close asChild>
                <IconButton label="Close" icon={X} size="sm" tooltipSide={null} />
              </Dialog.Close>
            </div>
            {description ? (
              <Dialog.Description className="pb-1 text-body-sm text-ink-2">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4',
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer ? (
            <div
              className={cn(
                'shrink-0 border-t-[1.5px] border-ink px-4 pt-3',
                bottom ? 'flex flex-col gap-2.5 pb-sheet' : 'flex justify-end gap-3 pb-4',
              )}
            >
              {footer}
            </div>
          ) : bottom ? (
            <div className="shrink-0 pb-safe" />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
