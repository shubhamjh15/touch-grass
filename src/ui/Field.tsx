'use client';

import { CircleAlert } from 'lucide-react';
import { useId, useMemo, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FieldContext, type FieldContextValue } from './fieldContext';

export type FieldProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** Always visible: a placeholder is never the label. */
  label: string;
  hint?: string;
  /** A plain sentence. Shown with an icon and announced; the control becomes `aria-invalid`. */
  error?: string;
  /** Adds the word "(required)" to the label, never an asterisk alone. */
  required?: boolean;
  /** One control from the kit (`Input`, `Textarea`, `Select`, `Slider` …). */
  children: ReactNode;
};

/** Label, hint and error for one control, wired with `htmlFor`, `aria-describedby` and `aria-invalid`. */
export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
  ...rest
}: FieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  const context = useMemo<FieldContextValue>(
    () => ({ controlId, describedBy, invalid: Boolean(error), required }),
    [controlId, describedBy, error, required],
  );

  return (
    <div className={cn('min-w-0', className)} {...rest}>
      <label htmlFor={controlId} className="mb-1.5 block text-label text-ink">
        {label}
        {required ? <span className="font-medium text-ink-3"> (required)</span> : null}
      </label>
      <FieldContext value={context}>{children}</FieldContext>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-caption font-semibold text-tomato-deep"
        >
          <CircleAlert size={16} strokeWidth={2.25} aria-hidden="true" className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-caption text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
