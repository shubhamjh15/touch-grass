'use client';

import type { ComponentProps, ElementType, Ref } from 'react';
import { cn } from '@/lib/cn';
import { looseTag } from './polymorphic';

export type PanelVariant = 'mat' | 'graph' | 'well' | 'paper';

const VARIANT: Record<PanelVariant, string> = {
  mat: 'graph-paper relative z-(--z-content)',
  graph: 'graph-paper rounded-lg border-3 border-ink p-4',
  well: 'rounded-md border-2 border-ink bg-mat-deep p-3 inset-shadow-deboss',
  paper: 'rounded-paper border-3 border-ink bg-paper p-4 shadow-3',
};

const EDGE = {
  'pinked-t': 'edge-pinked-t',
  'pinked-l': 'edge-pinked-l',
  none: '',
} as const;

export type PanelProps = Omit<ComponentProps<'div'>, 'ref'> & {
  ref?: Ref<HTMLElement>;
  /**
   * `mat` the desk (opaque graph paper, the only thing that may scroll over a stage) · `graph` a framed
   * piece of mat · `well` a sunk area · `paper` printed matter.
   */
  variant: PanelVariant;
  /** The pinked edge on the side that faces a stage (`mat` only). */
  edge?: keyof typeof EDGE;
  as?: ElementType;
};

export function Panel({ variant, edge = 'none', as = 'div', className, ...rest }: PanelProps) {
  const Comp = looseTag(as);
  return <Comp className={cn(VARIANT[variant], EDGE[edge], className)} {...rest} />;
}
