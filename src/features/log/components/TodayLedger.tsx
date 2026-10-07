'use client';

import { Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import {
  UNDO_WINDOW_MS,
  canUndo,
  game,
  gameActions,
  useGameNow,
  useProfile,
  useToday,
  type LogEntry,
} from '@/game';
import { BRAND } from '@/lib/brand';
import { formatCo2Estimate, formatNumber, formatStampDate, formatTime } from '@/lib/format';
import { play } from '@/lib/sfx';
import {
  Approx,
  CATEGORY_ICON,
  Co2e,
  ConfirmDialog,
  EmptyState,
  HonestyMark,
  IconButton,
  Ledger,
  Receipt,
  SectionHeading,
  Sticker,
  TextLink,
  type ReceiptRow,
} from '@/ui';
import { COPY } from '../copy';
import { logEstimateSource, totalEstimateSource } from '../model/estimate';
import { tileFor } from '../model/tiles';
import { formatQty, type UnitSystem } from '../model/units';

/** What a row is called: the sticker's caption for a catalogue action, the person's words otherwise. */
function rowTitle(log: LogEntry): string {
  if (!ACTION_BY_ID.has(log.actionId)) return log.title;
  const tile = tileFor(log.actionId);
  // A merged tile's caption would hide which material or garment it was.
  return tile && tile.kind === 'single' ? tile.label : log.title;
}

function rowMeta(log: LogEntry, system: UnitSystem): string[] {
  const parts = [formatTime(log.ts), formatQty(log.qty, log.unit, system)];
  const kind = COPY.quick.kind[log.kind];
  if (kind) parts.push(kind);
  parts.push(log.xp > 0 ? `+${formatNumber(log.xp)} XP` : COPY.ledger.kgOnly);
  return parts;
}

/**
 * Re-renders while any of today's logs can still be undone, so the Undo button turns into
 * Delete when its eight seconds are up, and stops ticking after that.
 */
function useUndoClock(logs: readonly LogEntry[]): number {
  const storeNow = useGameNow();
  const [now, setNow] = useState(() => game.now());
  const newest = logs[0]?.ts ?? 0;
  useEffect(() => {
    const left = newest + UNDO_WINDOW_MS - game.now();
    if (left <= 0) return undefined;
    const timer = window.setTimeout(() => setNow(game.now()), left + 30);
    return () => window.clearTimeout(timer);
  }, [newest, now]);
  return Math.max(now, storeNow);
}

function LogRow({
  log,
  system,
  undoable,
  onDelete,
}: {
  log: LogEntry;
  system: UnitSystem;
  undoable: boolean;
  onDelete: (log: LogEntry) => void;
}) {
  const tile = tileFor(log.actionId);
  const title = rowTitle(log);
  const quantified = log.co2eKg !== null && log.estimate !== 'none';
  const action = undoable ? (
    <IconButton
      label={`${COPY.ledger.undo}: ${title}`}
      icon={Undo2}
      size="sm"
      variant="reward"
      onClick={() => {
        play('tap');
        gameActions.undoLog(log.id);
      }}
    />
  ) : (
    <IconButton
      label={`${COPY.ledger.delete}: ${title}`}
      icon={Trash2}
      size="sm"
      onClick={() => onDelete(log)}
    />
  );
  return (
    <li className="flex animate-stick items-center gap-3 bg-card py-3 pr-2.5 pl-3.5">
      <Sticker
        category={log.category}
        icon={tile?.icon ?? CATEGORY_ICON[log.category]}
        size={32}
        rotate={-3}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-body font-bold break-words">{title}</p>
        <p className="mt-0.5 font-mono text-data-lg leading-tight">
          {quantified ? (
            <span className="inline-flex items-center gap-1.5">
              <HonestyMark source={logEstimateSource(log, system)} size="sm" />
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
            <span className="font-sans text-caption font-semibold text-ink-3">
              {COPY.ledger.notQuantified}
            </span>
          )}
        </p>
        <p className="mt-1 type-slug leading-[1.35] text-ink-3">
          {/* Each piece stays whole and the dot stays with the piece after it: no dot is left hanging at a line end. */}
          {rowMeta(log, system).map((part, index) => (
            <span key={part}>
              {index > 0 ? ' ' : null}
              <span className="whitespace-nowrap">
                {index > 0 ? '· ' : null}
                {part}
              </span>
            </span>
          ))}
        </p>
      </div>
      {action}
    </li>
  );
}

/**
 * "Stuck today": the day's logs, newest first, each with its time, amount, swap or keep, its
 * estimate and its XP, and a way to peel it off again. Ends in the till receipt whose total
 * opens how the figure was made.
 */
export function TodayLedger() {
  const today = useToday();
  const system: UnitSystem = useProfile().units;
  const now = useUndoClock(today.logs);
  const [doomed, setDoomed] = useState<LogEntry | null>(null);

  const rows: ReceiptRow[] = [
    { label: COPY.ledger.receiptActions, value: formatNumber(today.logs.length) },
    { label: COPY.ledger.receiptXp, value: `+${formatNumber(today.logXp)}` },
  ];
  if (today.aiKg > 0) {
    rows.push({
      label: COPY.ledger.receiptAi,
      value: (
        <>
          <Approx weight="mono" />
          <span className="underline decoration-dotted underline-offset-2">
            {formatCo2Estimate(today.aiKg)}
          </span>
        </>
      ),
    });
  }

  return (
    <section aria-labelledby="stuck-today">
      <SectionHeading
        id="stuck-today-heading"
        title={COPY.ledger.title}
        meta={today.logs.length > 0 ? formatNumber(today.logs.length) : undefined}
        className="mt-0"
      />
      <h2 id="stuck-today" className="sr-only">
        {COPY.ledger.label}
      </h2>
      {today.logs.length === 0 ? (
        <EmptyState
          slug={COPY.ledger.emptySlug}
          title={COPY.ledger.empty}
          category="nature"
          className="min-h-[180px] bg-card/60"
        />
      ) : (
        <div className="grid gap-5">
          <Ledger aria-label={COPY.ledger.label}>
            {today.logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                system={system}
                undoable={canUndo(log, now)}
                onDelete={setDoomed}
              />
            ))}
          </Ledger>
          <div>
            <Receipt
              title={`${BRAND.name} · today`}
              meta={formatStampDate(today.day)}
              rows={rows}
              total={{
                label: COPY.ledger.receiptTotal,
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <HonestyMark source={totalEstimateSource(today)} size="sm" />
                    <span className="sr-only">approximately </span>
                    {formatCo2Estimate(today.kg)}
                  </span>
                ),
              }}
            />
            <p className="mt-4 text-caption text-ink-3">
              {COPY.ledger.receiptNote}{' '}
              <TextLink href={ROUTES.methodology}>{COPY.ledger.methodology}</TextLink>
              <span className="sr-only">
                {' '}
                (<Co2e explain />)
              </span>
            </p>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={doomed !== null}
        onOpenChange={(open) => {
          if (!open) setDoomed(null);
        }}
        title={COPY.ledger.deleteTitle}
        description={COPY.ledger.deleteBody(doomed ? rowTitle(doomed) : '')}
        confirmLabel={COPY.ledger.deleteConfirm}
        cancelLabel={COPY.ledger.deleteCancel}
        destructive
        onConfirm={() => {
          if (doomed) gameActions.deleteLog(doomed.id);
        }}
      />
    </section>
  );
}
