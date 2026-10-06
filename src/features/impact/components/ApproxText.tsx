'use client';

import type { ReactNode } from 'react';
import { Approx, Co2e } from '@/ui';

const TOKEN = /(≈\s*|CO2e)/g;

/**
 * Game copy is plain text that contains "≈" and "CO2e". The typed glyph is missing from the
 * self-hosted font subsets, so each one becomes the drawn mark and the subscripted unit.
 */
export function ApproxText({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((part, index) => {
    if (/^≈\s*$/.test(part)) return <Approx key={index} weight="mono" />;
    if (part === 'CO2e') return <Co2e key={index} />;
    return part;
  });
}
