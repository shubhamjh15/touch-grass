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

const UNIT_TOKEN = /(CO2e?)(?![A-Za-z0-9])/g;

/**
 * Plain text that names the gas ("0.21 kg CO2e", "t CO2 per person"), with every "CO2" and "CO2e"
 * drawn with a real subscript. For strings that come from data or copy files.
 */
export function Co2Text({ text }: { text: string }) {
  return (
    <>
      {text.split(UNIT_TOKEN).map((part, index) => {
        if (part === 'CO2e') return <Co2e key={index} />;
        if (part === 'CO2') {
          return (
            <span key={index}>
              CO<sub>2</sub>
            </span>
          );
        }
        return part;
      })}
    </>
  );
}
