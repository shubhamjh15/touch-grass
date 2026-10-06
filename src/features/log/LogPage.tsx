'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AiClient } from '@/ai';
import { PageHeader } from '@/app/shell';
import type { CategoryId } from '@/data/catalogue';
import {
  exportFileName,
  game,
  gameActions,
  gameStore,
  useActionStates,
  type LogCustomInput,
  type LogResult,
  type LogSource,
  type SavedCustomAction,
} from '@/game';
import { buzz, play } from '@/lib/sfx';
import { Button, SearchInput, toast } from '@/ui';
import { ActionGrid } from './components/ActionGrid';
import { CategoryChips } from './components/CategoryChips';
import { HiddenActions } from './components/HiddenActions';
import { LoggedToday } from './components/LoggedToday';
import { QuickLogSheet, type LogJob, type QuickLogRequest } from './components/QuickLogSheet';
import { TreePop } from './components/TreePop';
import { COPY } from './copy';
import { parseLogParams, withoutLogParams } from './model/params';
import { searchTiles } from './model/search';
import { tileStates, tilesFor, type Tile } from './model/tiles';

// The custom flow brings the AI client with it; it loads when "Something else" is first opened.
const CustomFlow = lazy(() =>
  import('./components/CustomFlow').then((module) => ({ default: module.CustomFlow })),
);

/** Tiles shown before "Show all": with the "Something else" tile they fill whole rows of 2, 3 and 4. */
const FIRST_TILES = 11;

function downloadExport(): void {
  try {
    const url = URL.createObjectURL(
      new Blob([gameActions.exportState()], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(game.now());
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    toast({ title: COPY.toast.exportFailed, tone: 'info' });
  }
}

/**
 * Says what was refused, and offers an export when the device could not save. A log that
 * worked is announced by the shell's own toast (with Undo), not here.
 */
function reportResults(results: readonly LogResult[]): boolean {
  for (const result of results) {
    if (!result.ok) toast({ title: result.message, tone: 'info' });
  }
  const logged = results.some((result) => result.ok);
  if (logged && gameStore.getState().runtime.saveFailed) {
    toast({
      id: 'log-save-failed',
      title: COPY.toast.saveFailed,
      tone: 'danger',
      action: { label: COPY.toast.saveFailedAction, onClick: downloadExport },
    });
  }
  return logged;
}

export interface LogScreenProps {
  /** Test seam for the custom flow's AI client. */
  aiClient?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

/** The Log page: find an action, say how much, log it. */
export function LogScreen({ aiClient }: LogScreenProps) {
  const states = useActionStates();
  const tiles = useMemo(() => tileStates(states), [states]);

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [quick, setQuick] = useState<{ request: QuickLogRequest | null; open: boolean }>({
    request: null,
    open: false,
  });
  const [custom, setCustom] = useState({ open: false, text: '', session: 0 });
  /** Counts successful logs; each one mounts a fresh tree thumbnail. Zero: none on screen. */
  const [pop, setPop] = useState(0);
  const nonce = useRef(0);

  const openTile = useCallback(
    (
      tile: Tile,
      options: { actionId?: string | null; qty?: number | null; source?: LogSource } = {},
    ) => {
      nonce.current += 1;
      setQuick({
        open: true,
        request: {
          tile,
          actionId: options.actionId ?? null,
          qty: options.qty ?? null,
          source: options.source ?? 'log',
          nonce: nonce.current,
        },
      });
    },
    [],
  );
  const openFromGrid = useCallback((tile: Tile) => openTile(tile), [openTile]);

  const openCustom = useCallback((text = '') => {
    setCustom((current) => ({ open: true, text, session: current.session + 1 }));
  }, []);

  // A link can prepare a sheet (`?a=…&q=…`, `?custom=1`); it never logs by itself. The
  // parameters are consumed, so Back and a reload do not reopen what was closed.
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    const intent = parseLogParams(new URLSearchParams(search));
    if (intent.kind === 'none') return;
    if (intent.kind === 'unknown') toast({ title: COPY.toast.unknown, tone: 'info' });
    else if (intent.kind === 'custom') openCustom(intent.text);
    else openTile(intent.tile, intent);
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${withoutLogParams(window.location.search)}${hash}`,
    );
  }, [search, openCustom, openTile]);

  const finish = (results: readonly LogResult[]) => {
    if (reportResults(results)) setPop((count) => count + 1);
  };
  const clearPop = useCallback(() => setPop(0), []);

  const logAction = (job: LogJob) => {
    setQuick((current) => ({ ...current, open: false }));
    play('tap');
    buzz(10);
    finish(job.logs.map((input) => gameActions.logAction(input)));
  };

  const logCustom = (input: LogCustomInput) => {
    setCustom((current) => ({ ...current, open: false }));
    play('tap');
    buzz(10);
    const result = gameActions.logCustom(input);
    finish([result]);
    if (result.ok && input.save) toast({ title: COPY.custom.saved });
  };

  const logSaved = (saved: SavedCustomAction) => {
    setCustom((current) => ({ ...current, open: false }));
    play('tap');
    buzz(10);
    finish([gameActions.logSavedCustom(saved.id)]);
  };

  const hideTile = (tile: Tile) => {
    setQuick((current) => ({ ...current, open: false }));
    for (const actionId of tile.actionIds) gameActions.hideAction(actionId);
    toast({
      title: COPY.hidden.done(tile.label),
      action: {
        label: COPY.hidden.undo,
        onClick: () => {
          for (const actionId of tile.actionIds) gameActions.unhideAction(actionId);
        },
      },
    });
  };

  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchTiles(tiles, query) : []),
    [searching, tiles, query],
  );
  const browse = useMemo(() => tilesFor(tiles, category), [tiles, category]);
  const foldable = !searching && category === null && browse.length > FIRST_TILES;
  const shown = searching ? results : foldable && !expanded ? browse.slice(0, FIRST_TILES) : browse;
  const hidden = useMemo(() => tiles.filter((state) => state.hidden), [tiles]);

  const onQuery = (value: string) => {
    setQuery(value);
    // The field searches every kind, so the chips let go: the two never disagree.
    if (value.trim()) setCategory(null);
  };
  const onCategory = (value: CategoryId | null) => {
    setQuery('');
    setCategory(value);
  };
  const onCustomTile = useCallback(() => openCustom(query.trim()), [openCustom, query]);

  return (
    <div className="pb-4">
      <PageHeader title={COPY.title} lead={COPY.lead} grove={false} />

      <div className="grid grid-cols-1 gap-4">
        <SearchInput
          value={query}
          onValueChange={onQuery}
          label={COPY.search.label}
          placeholder={COPY.search.placeholder}
          resultCount={searching ? results.length : undefined}
        />
        <CategoryChips value={category} onChange={onCategory} />
      </div>

      <section className="mt-8" aria-label={COPY.grid.label}>
        {searching && results.length === 0 ? (
          <p role="status" className="mb-4 text-body text-ink-2">
            {COPY.search.miss(query.trim())}
          </p>
        ) : null}
        {!searching && category !== null && shown.length === 0 ? (
          <p className="mb-4 text-body text-ink-2">{COPY.grid.allHidden}</p>
        ) : null}
        <ActionGrid tiles={shown} onOpen={openFromGrid} onCustom={onCustomTile} />
        {foldable || hidden.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {foldable ? (
              <Button
                variant="neutral"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? COPY.grid.showFewer : COPY.grid.showAll(browse.length)}
              </Button>
            ) : null}
            <HiddenActions hidden={hidden} />
          </div>
        ) : null}
      </section>

      <div className="mt-12">
        <LoggedToday />
      </div>

      <QuickLogSheet
        request={quick.request}
        open={quick.open}
        onOpenChange={(open) => setQuick((current) => ({ ...current, open }))}
        onLog={logAction}
        onHide={hideTile}
      />
      {custom.session > 0 ? (
        <Suspense fallback={null}>
          <CustomFlow
            session={custom.session}
            open={custom.open}
            onOpenChange={(open) => setCustom((current) => ({ ...current, open }))}
            initialText={custom.text}
            tiles={tiles}
            onPickTile={(tile, actionId, qty) => {
              setCustom((current) => ({ ...current, open: false }));
              openTile(tile, { actionId, qty });
            }}
            onLog={logCustom}
            onLogSaved={logSaved}
            client={aiClient}
          />
        </Suspense>
      ) : null}
      {pop > 0 ? <TreePop key={pop} onDone={clearPop} /> : null}
    </div>
  );
}

/** Route `/log`. `useSearchParams` needs a Suspense boundary above it. */
export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogScreen />
    </Suspense>
  );
}
