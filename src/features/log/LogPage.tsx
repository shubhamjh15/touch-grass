'use client';

import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AiClient } from '@/ai';
import { PageHeader } from '@/app/shell';
import { CATEGORY_IDS } from '@/data/catalogue';
import {
  exportFileName,
  game,
  gameActions,
  gameStore,
  useActionStates,
  useProfile,
  type LogResult,
  type LogSource,
  type SavedCustomAction,
} from '@/game';
import { cn } from '@/lib/cn';
import {
  Button,
  CATEGORY,
  CATEGORY_ICON,
  ConfirmDialog,
  EmptyState,
  SearchInput,
  TabPanel,
  Tabs,
  toast,
  type TabItem,
} from '@/ui';
import { CustomFlow, type CustomStickJob } from './components/CustomFlow';
import { useLogMoment } from './components/LogMoment';
import { MyActions } from './components/MyActions';
import { QuickLogSheet, type QuickLogRequest, type StickJob } from './components/QuickLogSheet';
import { HiddenTray, StickerGrid } from './components/StickerSheet';
import { TodayLedger } from './components/TodayLedger';
import { COPY } from './copy';
import { parseLogParams, withoutLogParams } from './model/params';
import { searchTiles } from './model/search';
import {
  ACTION_COUNT,
  isLogTab,
  tileStates,
  tilesForTab,
  type LogTab,
  type Tile,
} from './model/tiles';

const SEARCH_TAB = 'search';
type TabValue = LogTab | typeof SEARCH_TAB;

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

/** Says what did not stick, and offers an export when the device could not save. */
function reportResults(results: readonly LogResult[]): void {
  for (const result of results) {
    if (!result.ok) toast({ title: result.message, tone: 'info' });
  }
  if (gameStore.getState().runtime.saveFailed && results.some((result) => result.ok)) {
    toast({
      id: 'log-save-failed',
      title: COPY.toast.saveFailed,
      tone: 'danger',
      action: { label: COPY.toast.saveFailedAction, onClick: downloadExport },
    });
  }
}

/**
 * True while the element sits pinned at `top`: a sentinel just above it has scrolled under
 * that line. Drives the opaque backing and the ink rule that only a stuck bar shows.
 */
function useStuck(): [(node: HTMLDivElement | null) => void, boolean] {
  const [stuck, setStuck] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const top = Number.parseFloat(getComputedStyle(node).getPropertyValue('--stick-top')) || 0;
    observer.current = new IntersectionObserver(
      ([entry]) => {
        if (entry) setStuck(!entry.isIntersecting && entry.boundingClientRect.top <= top);
      },
      { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 0 },
    );
    observer.current.observe(node);
  }, []);
  return [attach, stuck];
}

export interface LogScreenProps {
  /** Test seam for the custom flow's AI client. */
  aiClient?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

/** The Log page: the sticker sheet, the quick-log sheet, the custom flow and today's ledger. */
export function LogScreen({ aiClient }: LogScreenProps) {
  const states = useActionStates();
  const profile = useProfile();
  const tiles = useMemo(() => tileStates(states), [states]);

  const [tab, setTab] = useState<LogTab>('for-you');
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<{ request: QuickLogRequest | null; open: boolean }>({
    request: null,
    open: false,
  });
  const [custom, setCustom] = useState({ open: false, text: '', session: 0 });
  const [notForMe, setNotForMe] = useState<Tile | null>(null);
  const nonce = useRef(0);
  const { launch, layer } = useLogMoment();
  const [sentinel, stuck] = useStuck();

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

  const stickAction = (job: StickJob) => {
    setQuick((current) => ({ ...current, open: false }));
    launch({
      category: job.tile.category,
      icon: job.tile.icon,
      origin: job.origin,
      commit: () => reportResults(job.logs.map((input) => gameActions.logAction(input))),
    });
  };

  const stickCustom = (job: CustomStickJob) => {
    setCustom((current) => ({ ...current, open: false }));
    launch({
      category: job.category,
      icon: CATEGORY_ICON[job.category],
      origin: job.origin,
      commit: () => {
        const result = gameActions.logCustom(job.input);
        reportResults([result]);
        if (result.ok && job.input.save) toast({ title: COPY.custom.saved });
      },
    });
  };

  const stickSaved = (saved: SavedCustomAction, origin: Element | null) => {
    launch({
      category: saved.category,
      icon: CATEGORY_ICON[saved.category],
      origin,
      commit: () => reportResults([gameActions.logSavedCustom(saved.id)]),
    });
  };

  const askNotForMe = (tile: Tile) => {
    setQuick((current) => ({ ...current, open: false }));
    setNotForMe(tile);
  };

  const hideTile = (tile: Tile) => {
    for (const actionId of tile.actionIds) gameActions.hideAction(actionId);
    toast({
      title: COPY.notForMe.done(tile.label),
      action: {
        label: COPY.notForMe.undo,
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
  const active: TabValue = searching ? SEARCH_TAB : tab;

  const tabs: TabItem<TabValue>[] = [
    ...(searching
      ? [{ value: SEARCH_TAB, label: COPY.search.tab, count: results.length } as const]
      : []),
    { value: 'for-you', label: COPY.tabs.forYou },
    ...CATEGORY_IDS.map((id) => ({ value: id, label: CATEGORY[id].label })),
  ];

  const onTab = (value: TabValue) => {
    if (value === SEARCH_TAB) return;
    // Picking a kind while searching leaves the search: the tabs and the field never disagree.
    if (isLogTab(value)) {
      setQuery('');
      setTab(value);
    }
  };

  const shown = tilesForTab(tiles, tab);
  const hiddenHere = tiles.filter(
    (state) => state.hidden && (tab === 'for-you' || state.tile.category === tab),
  );
  const panelLabel =
    tab === 'for-you' ? COPY.tabs.forYou : `${CATEGORY[tab].label} · ${COPY.sheet.label}`;

  return (
    <div>
      <PageHeader
        slug={COPY.slug(ACTION_COUNT, CATEGORY_IDS.length)}
        title={COPY.title}
        lead={COPY.lead(profile.treeName)}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div
            ref={sentinel}
            aria-hidden="true"
            className="h-px [--stick-top:0px] lg:[--stick-top:86px]"
          />
          <div
            data-stuck={stuck || undefined}
            className={cn(
              'sticky top-0 z-(--z-sticky) -mx-4 px-4 py-2 md:-mx-6 md:px-6 lg:top-[86px] lg:mx-0 lg:px-0',
              // The backing reaches down behind the tab strip, which sticks right under the field.
              'after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[50px] after:border-b-[1.5px] after:border-transparent',
              'data-stuck:bg-mat data-stuck:after:border-ink data-stuck:after:bg-mat',
            )}
          >
            <SearchInput
              value={query}
              onValueChange={setQuery}
              label={COPY.search.label}
              placeholder={COPY.search.placeholder(ACTION_COUNT)}
              resultCount={searching ? results.length : undefined}
            />
          </div>

          <Tabs<TabValue>
            value={active}
            onValueChange={onTab}
            tabs={tabs}
            aria-label={COPY.tabs.label}
            className="mt-1.5"
            listClassName="sticky! top-[58px] z-(--z-sticky) lg:top-[144px] lg:[&_[role=tab]]:px-2.5"
          >
            <TabPanel value={SEARCH_TAB} className="p-2 md:p-3">
              {results.length > 0 ? (
                <StickerGrid
                  key={query}
                  tiles={results}
                  onOpen={openTile}
                  onNotForMe={askNotForMe}
                  label={COPY.search.count(results.length)}
                />
              ) : (
                <EmptyState
                  slug={COPY.search.missSlug}
                  title={COPY.search.miss}
                  category="stuff"
                  action={
                    <Button variant="primary" icon={Plus} onClick={() => openCustom(query.trim())}>
                      {COPY.search.missAction}
                    </Button>
                  }
                />
              )}
            </TabPanel>
            {(['for-you', ...CATEGORY_IDS] as const).map((value) => (
              <TabPanel key={value} value={value} className="p-2 md:p-3">
                {value === tab ? (
                  <>
                    {shown.length > 0 ? (
                      <StickerGrid
                        key={tab}
                        tiles={shown}
                        onOpen={openTile}
                        onNotForMe={askNotForMe}
                        label={panelLabel}
                      />
                    ) : null}
                    <HiddenTray hidden={hiddenHere} alone={shown.length === 0} />
                  </>
                ) : null}
              </TabPanel>
            ))}
          </Tabs>

          <div className="mt-6 flex flex-col gap-3 rounded-lg dieline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0">
              <span className="block text-h4">{COPY.custom.slotTitle}</span>
              <span className="mt-0.5 block text-body-sm text-ink-2">{COPY.custom.slotBody}</span>
            </p>
            <Button
              variant="neutral"
              icon={Plus}
              className="shrink-0 self-start sm:self-auto"
              onClick={() => openCustom()}
            >
              {COPY.custom.slotButton}
            </Button>
          </div>

          <MyActions onStick={stickSaved} />
        </div>

        <aside className="mt-10 lg:sticky lg:top-28 lg:mt-2 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto lg:pr-2 lg:pb-3">
          <TodayLedger />
        </aside>
      </div>

      <QuickLogSheet
        request={quick.request}
        open={quick.open}
        onOpenChange={(open) => setQuick((current) => ({ ...current, open }))}
        onStick={stickAction}
        onNotForMe={askNotForMe}
      />
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
        onStick={stickCustom}
        client={aiClient}
      />
      <ConfirmDialog
        open={notForMe !== null}
        onOpenChange={(open) => {
          if (!open) setNotForMe(null);
        }}
        title={notForMe ? COPY.notForMe.title(notForMe.label) : ''}
        description={COPY.notForMe.body}
        confirmLabel={COPY.notForMe.confirm}
        cancelLabel={COPY.notForMe.cancel}
        onConfirm={() => {
          if (notForMe) hideTile(notForMe);
        }}
      />
      {layer}
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
