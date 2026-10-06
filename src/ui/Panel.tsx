'use client';

import type { ComponentProps, ElementType, Ref } from 'react';
import { cn } from '@/lib/cn';
import { looseTag } from './polymorphic';

export type PanelVariant = 'mat' | 'graph' | 'well' | 'paper';

const VARIANT: Record<PanelVariant, string> = {
  mat: 'relative z-(--z-content) bg-mat',
  graph: 'rounded-lg border-2 border-ink bg-mat p-5',
  well: 'rounded-md bg-mat-deep p-4',
  paper: 'rounded-lg border-2 border-ink bg-paper p-5',
};

export type PanelProps = Omit<ComponentProps<'div'>, 'ref'> & {
  ref?: Ref<HTMLElement>;
  /**
   * `mat` the plain mint page surface · `graph` a framed piece of it · `well` a quiet tinted area
   * inside a card · `paper` a warm card. None of them carries a pattern or a shadow.
   */
  variant: PanelVariant;
  /** Retired: panels have no decorated edges. Accepted so older callers keep compiling. */
  edge?: 'pinked-t' | 'pinked-l' | 'none';
  as?: ElementType;
};

export function Panel({ variant, edge: _edge, as = 'div', className, ...rest }: PanelProps) {
  const Comp = looseTag(as);
  return <Comp className={cn(VARIANT[variant], className)} {...rest} />;
}
