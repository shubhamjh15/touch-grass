'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { ActionDef } from '@/data/catalogue';
import { play } from '@/lib/sfx';
import { IconButton, Input, Segmented, type SegmentedOption } from '@/ui';
import { COPY } from '../copy';
import {
  parseQty,
  presetFor,
  presetOptions,
  qtyFieldText,
  snapQty,
  stepFor,
  toDisplayQty,
  toStoredQty,
  unitSuffix,
  type UnitSystem,
} from '../model/units';

export interface QuantityPickerProps {
  action: Pick<ActionDef, 'presets' | 'unit' | 'decimals' | 'dailyCap'>;
  system: UnitSystem;
  /** The stored (metric) quantity, or `null` while the typed amount cannot be read. */
  qty: number | null;
  onChange: (qty: number | null) => void;
  /** What today's cap still allows, in stored units. Presets beyond it are unavailable. */
  unitsLeft: number;
  /** Visible question above the presets: "How much?". */
  label: string;
  /** Message under the amount field; marks it invalid. */
  error?: string;
}

/**
 * The amount: the action's presets, and a stepper around a field that can also be typed in.
 * Works in the person's units and reports the stored metric quantity.
 */
export function QuantityPicker({
  action,
  system,
  qty,
  onChange,
  unitsLeft,
  label,
  error,
}: QuantityPickerProps) {
  const options = presetOptions(action, system);
  const matched = qty === null ? null : presetFor(qty, options);
  const [text, setText] = useState(() =>
    qty === null ? '' : qtyFieldText(qty, action.unit, system),
  );
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const segments: SegmentedOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.qty > unitsLeft + 1e-9,
  }));

  const commit = (shown: number) => {
    onChange(toStoredQty(shown, action.unit, system, action.decimals));
  };

  const onPreset = (value: string) => {
    const option = options.find((candidate) => candidate.value === value);
    if (!option) return;
    play('tick');
    setText(qtyFieldText(option.qty, action.unit, system));
    onChange(option.qty);
  };

  const onType = (next: string) => {
    setText(next);
    const shown = parseQty(next);
    if (shown === null) onChange(null);
    else commit(shown);
  };

  const step = stepFor(action);
  const shownNow = qty === null ? null : toDisplayQty(qty, action.unit, system);
  const nudge = (direction: 1 | -1) => {
    play('tick', { rate: direction === 1 ? 1.1 : 0.9 });
    const next = snapQty(Math.max(step, (shownNow ?? 0) + direction * step), action.decimals);
    setText(String(next));
    commit(next);
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <label htmlFor={fieldId} className="text-label text-ink">
        {label}
      </label>
      {segments.length > 1 ? (
        <Segmented
          aria-label={COPY.quick.presets}
          value={matched?.value ?? ''}
          onValueChange={onPreset}
          options={segments}
          fullWidth
        />
      ) : null}
      <div className="flex items-center gap-2.5">
        <IconButton
          label={COPY.quick.less}
          icon={Minus}
          shape="square"
          tooltipSide={null}
          disabled={shownNow !== null && shownNow <= step}
          onClick={() => nudge(-1)}
        />
        <Input
          id={fieldId}
          inputMode={action.decimals === 0 ? 'numeric' : 'decimal'}
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          onChange={(event) => onType(event.target.value)}
          suffix={unitSuffix(action.unit, system)}
          invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1"
          inputClassName="text-center font-bold"
        />
        <IconButton
          label={COPY.quick.more}
          icon={Plus}
          shape="square"
          tooltipSide={null}
          onClick={() => nudge(1)}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-body-sm font-semibold text-tomato-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
