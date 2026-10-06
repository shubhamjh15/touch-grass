'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import { canUndo, game, gameActions, useProfile, useToday, type LogEntry } from '@/game';
import { cn } from '@/lib/cn';
import { formatCo2Estimate } from '@/lib/format';
import { play } from '@/lib/sfx';
import { Button, CATEGORY_ICON, ConfirmDialog, HonestyMark, Sticker, TextLink } from '@/ui';
import { COPY } from '../copy';
import { logEstimateSource } from '../model/estimate';
import { tileFor } from '../model/tiles';
import { formatQty, type UnitSystem } from '../model/units';

/** What a row is called: the sticker's caption for a catalogue action, the person's words otherwise. */
function rowTitle(log: LogEntry): string {
  if (!ACTION_BY_ID.has(log.actionId)) return log.title;
  const tile = tileFor(log.actionId);
  // A merged tile's caption would hide which material or garment it was.
  return tile && tile.kind === 'single' ? tile.label : log.title;
}

function LogRow({
  log,
  system,
  onUndo,
}: {
  log: LogEntry;
  system: UnitSystem;
  onUndo: (log: LogEntry) => void;
}) {
  const tile = tileFor(log.actionId);
  const title = rowTitle(log);
  const quantified = log.co2eKg !== null && log.estimate !== 'none';
  return (
    <li className="flex items-center gap-3 py-3">
      <Sticker
        category={log.category}
        icon={tile?.icon ?? CATEGORY_ICON[log.category]}
        size={32}
        rotate={0}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-body font-semibold text-ink">{title}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-ink-2">
          <span>{formatQty(log.qty, log.unit, system)}</span>
          <span aria-hidden="true">·</span>
          {quantified ? (
            <span className="inline-flex items-center gap-1">
              <HonestyMark source={logEstimateSource(log)} size="sm" />
              <span className="sr-only">approximately </span>
              <span
                className={
                  log.estimate === 'ai'
                    ? 'underline decoration-dotted decoration-2 underline-offset-4'
                    : undefined
                }
              >
                {formatCo2Estimate(log.co2eKg ?? 0)}
              </span>
            </span>
          ) : (
            <span>{COPY.today.notQuantified}</span>
          )}
        </p>
      </div>
      <Button
        variant="neutral"
        size="sm"
        aria-label={COPY.today.undoName(title)}
        onClick={() => onUndo(log)}
      >
        {COPY.today.undo}
      </Button>
    </li>
  );
}

/**
 * "Logged today (2)": closed until asked for. Each row can be undone: at once while the log is
 * fresh, after a question once the day has been counted with it.
 */
export function LoggedToday() {
  const today = useToday();
  const system: UnitSystem = useProfile().units;
  const [open, setOpen] = useState(false);
  const [doomed, setDoomed] = useState<LogEntry | null>(null);
  const panelId = useId();
  const count = today.logs.length;

  const undo = (log: LogEntry) => {
    if (canUndo(log, game.now())) {
      play('tap');
      gameActions.undoLog(log.id);
    } else {
      setDoomed(log);
    }
  };

  if (count === 0) {
    return <p className="text-body text-ink-2">{COPY.today.empty}</p>;
  }

  return (
    <section className="rounded-lg border-2 border-ink bg-card">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-5 text-left text-h3 text-ink focus-inset"
          onClick={() => setOpen((value) => !value)}
        >
          {COPY.today.title(count)}
          <ChevronDown
            size={20}
            strokeWidth={1.75}
            aria-hidden="true"
            className={cn(
              'shrink-0 transition-transform duration-(--dur-fast) ease-out',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="px-5 pb-4">
        <ul aria-label={COPY.today.label} className="divide-y divide-line border-t border-line">
          {today.logs.map((log) => (
            <LogRow key={log.id} log={log} system={system} onUndo={undo} />
          ))}
        </ul>
        <p className="pt-2">
          <TextLink href={ROUTES.impact} className="inline-flex min-h-11 items-center text-body-sm">
            {COPY.today.impact}
          </TextLink>
        </p>
      </div>
      <ConfirmDialog
        open={doomed !== null}
        onOpenChange={(next) => {
          if (!next) setDoomed(null);
        }}
        title={COPY.today.deleteTitle}
        description={COPY.today.deleteBody(doomed ? rowTitle(doomed) : '')}
        confirmLabel={COPY.today.deleteConfirm}
        cancelLabel={COPY.today.deleteCancel}
        destructive
        onConfirm={() => {
          if (doomed) gameActions.deleteLog(doomed.id);
        }}
      />
    </section>
  );
}
