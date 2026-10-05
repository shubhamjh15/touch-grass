'use client';

import { createContext, use } from 'react';

export interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * The attributes a control needs to belong to the surrounding `Field`: its id (the label's target),
 * the hint and error ids, and the invalid flag. Explicit props on the control win.
 */
export function useFieldControl(own: {
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
}): FieldControlProps & { invalid: boolean } {
  const field = use(FieldContext);
  const invalid = own.invalid ?? field?.invalid ?? false;
  const describedBy =
    [own['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined;
  return {
    id: own.id ?? field?.controlId,
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? true : undefined,
    'aria-required': field?.required ? true : undefined,
    invalid,
  };
}
