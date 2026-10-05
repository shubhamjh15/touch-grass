'use client';

import type { ComponentProps } from 'react';

export type Co2eProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** First use on a page: wraps the unit in an `abbr` that spells it out. */
  explain?: boolean;
};

/** "CO2e" with a real subscript (the typed subscript two is not in the font subsets). */
export function Co2e({ explain = false, ...rest }: Co2eProps) {
  const unit = (
    <>
      CO<sub>2</sub>e
    </>
  );
  return (
    <span {...rest}>{explain ? <abbr title="carbon dioxide equivalent">{unit}</abbr> : unit}</span>
  );
}
