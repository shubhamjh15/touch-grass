'use client';

import { useMemo } from 'react';
import type { Impact } from '@/game';
import { Approx, Co2e, HonestyMark, Receipt, type ReceiptRow } from '@/ui';
import { COPY } from '../copy';
import { equivalenceRow, kgParts, totalsSource } from '../model';
import { ApproxText } from './ApproxText';

/**
 * "In other words": the total as things you can picture, printed on a till receipt. Each line
 * wears the drawn "≈", and the sentence under it is the spec's phrasing: "roughly the CO2 from",
 * never an outcome.
 */
export function EquivalencesCard({ impact, meta }: { impact: Impact; meta: string }) {
  const source = useMemo(() => totalsSource(impact), [impact]);
  const parts = kgParts(impact.kg);
  const rows: ReceiptRow[] = impact.equivalences.map((item) => {
    const line = equivalenceRow(item);
    return {
      label: line.label,
      value: (
        <span className="font-semibold">
          <Approx weight="mono" />
          {line.value}
        </span>
      ),
    };
  });

  if (rows.length === 0) {
    return <p className="text-body-sm text-ink-2">{COPY.equivalences.empty}</p>;
  }

  return (
    <div className="grid content-start gap-3">
      <Receipt
        title={COPY.equivalences.receiptTitle}
        meta={meta}
        rows={rows}
        total={{
          label: COPY.equivalences.totalLabel,
          value: (
            <span className="inline-flex items-center gap-1.5">
              <HonestyMark source={source} size="sm" />
              <span>
                {parts.value} {parts.unit} <Co2e />
              </span>
            </span>
          ),
        }}
      />
      <ul className="grid gap-1 text-body-sm text-ink-2">
        {impact.equivalences.map((item) => (
          <li key={item.id}>
            <ApproxText text={item.text} />
          </li>
        ))}
      </ul>
    </div>
  );
}
