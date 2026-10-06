'use client';

import { BookOpen, Check, Plus, Target, Trees } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { gameActions, growPulseStrength, useProfile } from '@/game';
import { cn } from '@/lib/cn';
import { Approx, Button, Chip, Co2e, HonestyMark, Tag, toast } from '@/ui';
import { useCoachUi } from '../coachUi';
import { CHIP_COPY, stuckToastTitle } from '../copy';
import { chipLabel, type ChipView, type LogChipView } from '../model/chips';
import { previewLine } from '../model/estimate';
import { formatQuantity } from '../model/quantity';
import { useLogPreview } from '../useChipWorld';

/** 3 to 8 fresh leaves, the same range the grove's grow burst uses. */
function leavesFor(gp: number): number {
  return Math.round(3 + ((growPulseStrength(gp) - 0.2) / 0.8) * 5);
}

function undo(logId: string): void {
  const result = gameActions.undoLog(logId);
  useCoachUi.getState().unmarkStuck(logId);
  toast(
    result.ok
      ? { id: `log-${logId}`, title: CHIP_COPY.undone }
      : { id: `log-${logId}`, title: CHIP_COPY.undoExpired, tone: 'info' },
  );
}

interface LogConfirmProps {
  id: string;
  chip: LogChipView;
  stuckKey: string;
  onClose: (stuck: boolean) => void;
  onNavigate?: () => void;
}

/**
 * The confirmation a log chip opens, in place: quantity, the engine's own honest preview,
 * and one button that really logs. Nothing is saved until "Stick it on" is pressed.
 */
function LogConfirm({ id, chip, stuckKey, onClose, onNavigate }: LogConfirmProps) {
  const { treeName, units } = useProfile();
  const [qty, setQty] = useState(chip.qty);
  const [refusal, setRefusal] = useState<string | null>(null);
  const preview = useLogPreview(chip.actionId, qty);
  const line = previewLine(chip.actionId, preview);
  const blocked = preview.refusal?.message ?? null;

  const stick = () => {
    const result = gameActions.logAction({ actionId: chip.actionId, qty, source: 'coach' });
    if (!result.ok) {
      setRefusal(result.message);
      return;
    }
    const { log } = result;
    useCoachUi.getState().markStuck(stuckKey, log.id);
    const firstAct = log.rewardedActs > 0 && preview.rewardedActs > 0 && preview.gp !== log.gp;
    toast({
      id: `log-${log.id}`,
      title: stuckToastTitle(treeName, leavesFor(log.gp), firstAct),
      category: log.category,
      meta:
        line?.kgText && log.co2eKg !== null ? (
          <>
            <Approx weight="mono" />
            {line.kgText} <Co2e /> · {CHIP_COPY.xp(log.xp)}
          </>
        ) : (
          CHIP_COPY.xp(log.xp)
        ),
      action: { label: CHIP_COPY.undo, onClick: () => undo(log.id) },
    });
    onClose(true);
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={CHIP_COPY.confirmLabel(chip.title)}
      className="mt-3 rounded-paper border-2 border-ink bg-paper p-3 motion-safe:animate-stick"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag category={chip.category} />
        <p className="min-w-0 text-label font-bold text-ink">{chip.title}</p>
      </div>

      {chip.options.length > 1 ? (
        <fieldset className="mt-3">
          <legend className="type-slug text-ink-3">{CHIP_COPY.howMuch}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {chip.options.map((option) => (
              <Chip
                key={option}
                selected={option === qty}
                onClick={() => {
                  setQty(option);
                  setRefusal(null);
                }}
              >
                {formatQuantity(option, chip.unit, units)}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-2 font-mono text-data text-ink-2">
          {formatQuantity(qty, chip.unit, units)}
        </p>
      )}

      {line ? (
        <p className="mt-3 text-body-sm text-ink">
          {line.kgText ? (
            <>
              <HonestyMark source={line.source} size="sm" className="mr-1.5" />
              <b className="font-bold">
                <span className="sr-only">approximately </span>
                {line.kgText} <Co2e /> {CHIP_COPY.avoided}
              </b>{' '}
              {CHIP_COPY.versus} {line.comparedWith}
            </>
          ) : (
            <>
              <b className="font-bold">{CHIP_COPY.notEstimated}</b> {line.unquantified}
            </>
          )}
          {line.xp > 0 ? (
            <span className="font-mono text-data font-semibold whitespace-nowrap">
              {' '}
              · {CHIP_COPY.xp(line.xp)}
            </span>
          ) : null}
        </p>
      ) : null}
      {line?.maxed && !blocked ? (
        <p className="mt-1.5 text-caption text-ink-2">{CHIP_COPY.kgOnly}</p>
      ) : null}

      {(refusal ?? blocked) ? (
        <p role="alert" className="mt-2 text-body-sm font-semibold text-tomato-deep">
          {refusal ?? blocked}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={stick}
          disabledReason={blocked ?? undefined}
        >
          {CHIP_COPY.stick}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onClose(false)}>
          {CHIP_COPY.notNow}
        </Button>
        <Link
          href={chip.href}
          onClick={onNavigate}
          className="ml-auto inline-flex min-h-11 items-center link text-caption"
        >
          {CHIP_COPY.openInLog}
        </Link>
      </div>
    </div>
  );
}

function LogChipButton({
  chip,
  open,
  controls,
  onToggle,
  buttonRef,
}: {
  chip: LogChipView;
  open: boolean;
  controls: string;
  onToggle: () => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}) {
  const preview = useLogPreview(chip.actionId, chip.qty);
  return (
    <Button
      ref={buttonRef}
      variant="primary"
      size="sm"
      icon={Plus}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
      className="max-w-full"
    >
      <span className="sr-only">Log: </span>
      <span className="min-w-0 truncate">{chipLabel(chip)}</span>
      {preview.xp > 0 ? (
        <span className="shrink-0 font-mono text-[0.6875rem] font-semibold">
          {CHIP_COPY.xp(preview.xp)}
        </span>
      ) : null}
    </Button>
  );
}

const LINK_CHIP =
  'hit-1 inline-flex h-9 max-w-full items-center gap-2 rounded-sm border-3 border-ink bg-white px-3 text-button-sm text-ink hard lift-3';

export interface ChipRowProps {
  messageId: string;
  chips: readonly ChipView[];
  /** Called before a chip leaves for another page (the drawer closes itself). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The suggestions under an answer. A log chip opens a confirmation right here and becomes
 * "Stuck" once used; lesson, quest and break chips are links to where those things live.
 */
export function ChipRow({ messageId, chips, onNavigate, className }: ChipRowProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const stuck = useCoachUi((state) => state.stuck);
  const confirmId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  if (chips.length === 0) return null;

  const openChip = chips.find(
    (chip): chip is LogChipView => chip.kind === 'log' && chip.key === openKey,
  );

  return (
    <div className={cn('mt-3', className)}>
      <ul aria-label={CHIP_COPY.groupLabel} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const stuckKey = `${messageId}|${chip.key}`;
          if (chip.kind === 'log') {
            return (
              <li key={chip.key} className="max-w-full min-w-0">
                {stuck[stuckKey] ? (
                  <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-sm border-2 border-dashed border-ink-3 bg-green-tint px-3 text-button-sm text-ink">
                    <Check size={16} strokeWidth={3} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 truncate">
                      {CHIP_COPY.stuck}: {chipLabel(chip)}
                    </span>
                  </span>
                ) : (
                  <LogChipButton
                    chip={chip}
                    open={openKey === chip.key}
                    controls={confirmId}
                    onToggle={() => setOpenKey((key) => (key === chip.key ? null : chip.key))}
                    buttonRef={(node) => {
                      if (node) buttons.current.set(chip.key, node);
                      else buttons.current.delete(chip.key);
                    }}
                  />
                )}
              </li>
            );
          }
          const Icon = chip.kind === 'learn' ? BookOpen : chip.kind === 'quest' ? Target : Trees;
          return (
            <li key={chip.key} className="max-w-full min-w-0">
              <Link href={chip.href} onClick={onNavigate} className={LINK_CHIP}>
                <Icon size={16} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 truncate">{chipLabel(chip)}</span>
                {chip.kind === 'learn' ? (
                  <span className="shrink-0 font-mono text-[0.6875rem] font-semibold text-ink-2">
                    {CHIP_COPY.minutes(chip.minutes)}
                  </span>
                ) : null}
                {chip.kind === 'quest' ? (
                  <span className="shrink-0 font-mono text-[0.6875rem] font-semibold text-ink-2">
                    {chip.progressText}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {openChip && !stuck[`${messageId}|${openChip.key}`] ? (
        <LogConfirm
          key={openChip.key}
          id={confirmId}
          chip={openChip}
          stuckKey={`${messageId}|${openChip.key}`}
          onNavigate={onNavigate}
          onClose={(didStick) => {
            // Focus goes back to the chip, so a keyboard user is never left on nothing.
            if (!didStick) buttons.current.get(openChip.key)?.focus();
            setOpenKey(null);
          }}
        />
      ) : null}
    </div>
  );
}
