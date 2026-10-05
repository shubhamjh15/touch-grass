'use client';

import { toast as sonner } from 'sonner';
import { ToastCard, type ToastCardProps } from './ToastCard';

export type ToastOptions = Omit<ToastCardProps, 'onDismiss'> & {
  /** Reuse an id to replace a toast in place (several logs collapsing into one). */
  id?: string | number;
};

const DEFAULT_MS = 4000;
const WITH_ACTION_MS = 8000;

/**
 * Prints a toast. 4 s by default, 8 s when it carries an action (Undo), and errors (`tone: 'danger'`)
 * stay until dismissed. One sentence per event: the toast is also what screen readers hear.
 *
 * `toast({ title: 'Stuck. Fern grew 6 leaves.', category: 'move', action: { label: 'Undo', onClick } })`
 */
export function toast(options: ToastOptions): string | number {
  const { id, duration: wanted, ...card } = options;
  const duration =
    wanted ??
    (card.tone === 'danger' ? Number.POSITIVE_INFINITY : card.action ? WITH_ACTION_MS : DEFAULT_MS);
  return sonner.custom(
    (toastId) => (
      <ToastCard {...card} duration={duration} onDismiss={() => sonner.dismiss(toastId)} />
    ),
    { id, duration },
  );
}

/** Removes one toast, or all of them when called without an id. */
export function dismissToast(id?: string | number): void {
  sonner.dismiss(id);
}
