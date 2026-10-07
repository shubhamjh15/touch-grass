'use client';

import { Download, FileSpreadsheet, FileUp, Smartphone, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { RecoveryNote } from '@/app/runtime/RecoveryNote';
import { gameActions, useGameRuntime, useGameState, type ImportResult } from '@/game';
import { Button, Card, Checkbox, ConfirmDialog, Ledger, ListRow, Textarea, toast } from '@/ui';
import { COPY } from '../copy';
import { formatStorage, readImportFile } from '../model/dataFiles';
import { ImportDialog } from './ImportDialog';
import { ResetDialog } from './ResetDialog';
import { useDataExport } from './useDataExport';
import { useInstallPrompt } from './useInstallPrompt';

type Pending = Extract<ImportResult, { ok: true }> & { text: string };

function Heading({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="grid gap-0.5">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      <p className="max-w-prose text-body-sm text-ink-2">{lead}</p>
    </div>
  );
}

function ExportBlock({ data }: { data: ReturnType<typeof useDataExport> }) {
  const logs = useGameState((game) => game.logs.length);
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);

  const copy = async () => {
    if (data.fallback === null) return;
    try {
      await navigator.clipboard.writeText(data.fallback);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <section aria-labelledby="data-export-heading" className="grid gap-3">
      <Heading
        id="data-export-heading"
        title={COPY.data.exportHeading}
        lead={COPY.data.exportLead}
      />
      <Card className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Button variant="primary" icon={Download} onClick={data.exportJson} fullWidth>
              {COPY.data.exportJson}
            </Button>
            <p className="text-caption text-ink-2">{COPY.data.exportJsonHint}</p>
          </div>
          <div className="grid content-start gap-1.5">
            <Button variant="neutral" icon={FileSpreadsheet} onClick={data.exportCsv} fullWidth>
              {COPY.data.exportCsv}
            </Button>
            <p className="text-caption text-ink-2">
              {logs === 0 ? COPY.data.noLogs : COPY.data.exportCsvHint}
            </p>
          </div>
        </div>
        <Checkbox
          checked={data.includeCoach}
          onCheckedChange={data.setIncludeCoach}
          label={COPY.data.includeCoach}
        />
        {data.fallback !== null ? (
          <div className="grid gap-2 rounded-md border-2 border-ink bg-yellow-tint p-3.5">
            <p className="text-body-sm font-semibold text-ink">{COPY.data.exportFailed}</p>
            <Textarea
              readOnly
              rows={4}
              value={data.fallback}
              aria-label={COPY.data.fallbackLabel}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-data-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="neutral" size="sm" onClick={() => void copy()}>
                {COPY.data.copyText}
              </Button>
              <p aria-live="polite" className="text-body-sm font-semibold">
                {copied === 'done'
                  ? COPY.data.copied
                  : copied === 'failed'
                    ? COPY.data.copyFailed
                    : ''}
              </p>
            </div>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function ImportBlock() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<{ message: string; detail: string | null } | null>(null);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again after a failure.
    event.target.value = '';
    if (!file) return;
    setProblem(null);
    const read = await readImportFile(file);
    if (!read.ok) {
      setProblem({ message: read.message, detail: null });
      return;
    }
    const result = gameActions.previewImport(read.text);
    if (result.ok) setPending({ ...result, text: read.text });
    else
      setProblem({
        message: `${result.message} ${COPY.data.importNothing}`,
        detail: result.detail,
      });
  };

  return (
    <section aria-labelledby="data-import-heading" className="grid gap-3">
      <Heading
        id="data-import-heading"
        title={COPY.data.importHeading}
        lead={COPY.data.importLead}
      />
      <Card className="grid gap-3">
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label={COPY.data.importFileLabel}
          onChange={(event) => void choose(event)}
          className="sr-only"
          tabIndex={-1}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="neutral" icon={FileUp} onClick={() => input.current?.click()}>
            {COPY.data.importChoose}
          </Button>
          <p className="text-caption text-ink-2">{COPY.data.importAccepts}</p>
        </div>
        {problem ? (
          <div
            role="alert"
            className="grid gap-1 rounded-md border-2 border-tomato-deep bg-tomato-tint p-3.5"
          >
            <p className="text-body-sm font-bold text-ink">{COPY.data.importFailedTitle}</p>
            <p className="text-body-sm text-ink">{problem.message}</p>
            {problem.detail ? (
              <details className="text-caption text-ink-2">
                <summary className="cursor-pointer">{COPY.data.importDetails}</summary>
                <p className="mt-1 font-mono break-words">{problem.detail}</p>
              </details>
            ) : null}
          </div>
        ) : null}
      </Card>
      {pending ? (
        <ImportDialog
          text={pending.text}
          preview={pending.preview}
          checksumMismatch={pending.checksumMismatch}
          onClose={() => setPending(null)}
        />
      ) : null}
    </section>
  );
}

function DeviceBlock() {
  const runtime = useGameRuntime();
  const install = useInstallPrompt();
  const [legacyAsk, setLegacyAsk] = useState(false);
  const [legacy, setLegacy] = useState(() => gameActions.legacyBackup());
  const bytes = gameActions.storageUsedBytes();

  const downloadLegacy = () => {
    if (legacy === null) return;
    const url = URL.createObjectURL(new Blob([legacy], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'touch-grass-old-app-backup.json';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section aria-labelledby="data-device-heading" className="grid gap-3">
      <h2 id="data-device-heading" className="text-h3">
        {COPY.data.deviceHeading}
      </h2>
      {runtime.storage === 'memory' || runtime.saveFailed ? (
        <p
          role="alert"
          className="rounded-md border-2 border-ink bg-yellow-tint p-3.5 text-body-sm font-semibold text-ink"
        >
          {runtime.saveFailed ? COPY.data.saveFailed : COPY.data.memoryWarning}
        </p>
      ) : null}
      <Ledger aria-label={COPY.data.deviceHeading}>
        <ListRow
          title={COPY.data.storage}
          description={COPY.data.storageValue(formatStorage(bytes))}
        />
        {install.state === 'unavailable' ? null : (
          <ListRow
            title={COPY.data.install}
            description={
              install.state === 'installed' ? COPY.data.installed : COPY.data.installHint
            }
            trailing={
              install.state === 'ready' ? (
                <Button
                  variant="neutral"
                  size="sm"
                  icon={Smartphone}
                  onClick={() => void install.install()}
                >
                  {COPY.data.install}
                </Button>
              ) : null
            }
          />
        )}
        {legacy === null ? null : (
          <ListRow
            title={COPY.data.legacyHeading}
            description={COPY.data.legacyHint}
            trailing={
              <>
                <Button variant="neutral" size="sm" onClick={downloadLegacy}>
                  {COPY.data.legacyDownload}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLegacyAsk(true)}>
                  {COPY.data.legacyDelete}
                </Button>
              </>
            }
          />
        )}
      </Ledger>
      <ConfirmDialog
        open={legacyAsk}
        onOpenChange={setLegacyAsk}
        title={COPY.data.legacyDeleteTitle}
        description={COPY.data.legacyDeleteBody}
        confirmLabel={COPY.data.legacyDelete}
        destructive
        onConfirm={() => {
          gameActions.deleteLegacyBackup();
          setLegacy(null);
          toast({ title: COPY.data.legacyDeleted });
        }}
      />
    </section>
  );
}

function ResetBlock({ data }: { data: ReturnType<typeof useDataExport> }) {
  const [open, setOpen] = useState(false);
  return (
    <section id="reset" aria-labelledby="data-reset-heading" className="grid scroll-mt-24 gap-3">
      <Heading id="data-reset-heading" title={COPY.data.resetHeading} lead={COPY.data.resetLead} />
      <div>
        <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
          {COPY.data.resetOpen}
        </Button>
      </div>
      <ResetDialog open={open} onOpenChange={setOpen} data={data} />
    </section>
  );
}

/** Export, import with a preview, what is stored on this device, and reset behind a typed name. */
export function DataPanel() {
  const data = useDataExport();
  return (
    <div className="grid gap-8">
      <RecoveryNote />
      <ExportBlock data={data} />
      <ImportBlock />
      <DeviceBlock />
      <ResetBlock data={data} />
    </div>
  );
}
