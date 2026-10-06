'use client';

import { ArrowRight, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { exportFileName, game, gameActions, useGameHydrated, useIsOnboarded } from '@/game';
import { Button, Card, Checkbox, ConfirmDialog, Skeleton, UiLink } from '@/ui';
import { YOUR_DATA } from '../copy';

function saveFile(text: string, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** "12 KB": how much of the browser's storage the app uses, to the nearest unit. */
function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Export and delete, where the privacy promise is kept: the same two actions as Me, one tap
 * from the page that says they exist. It reads saved state, so it waits for hydration.
 */
export function YourData() {
  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  const [withCoach, setWithCoach] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!hydrated) {
    return <Skeleton shape="block" className="h-44" aria-label="Checking this device" />;
  }

  const exportJson = () => {
    const name = exportFileName(game.now());
    saveFile(gameActions.exportState({ includeCoach: withCoach }), 'application/json', name);
    setMessage(`Saved ${name} to your downloads.`);
  };

  const exportCsv = () => {
    saveFile(
      gameActions.exportLogsCsv(),
      'text/csv',
      exportFileName(game.now()).replace(/\.json$/, '.csv'),
    );
    setMessage('Saved your logs as a spreadsheet to your downloads.');
  };

  const remove = () => {
    gameActions.resetAll();
    setMessage(YOUR_DATA.deleted);
  };

  const status = (
    <p role="status" className="min-h-6 text-body-sm font-semibold">
      {message}
    </p>
  );

  if (!onboarded) {
    return (
      <Card tone="paper" className="grid gap-3 lg:max-w-3xl">
        <h3 className="text-h4">{YOUR_DATA.emptyTitle}</h3>
        <p className="max-w-[56ch] text-body text-ink-2">{YOUR_DATA.emptyBody}</p>
        {status}
        <div>
          <Button asChild variant="primary" iconRight={ArrowRight}>
            <UiLink href={ROUTES.start}>Plant your tree</UiLink>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="grid gap-4 lg:max-w-3xl">
      <div className="grid gap-1">
        <h3 className="text-h4">{YOUR_DATA.title}</h3>
        <p className="max-w-[56ch] text-body-sm text-ink-2">
          {YOUR_DATA.using(sizeText(gameActions.storageUsedBytes()))}
        </p>
      </div>
      <Checkbox
        checked={withCoach}
        onCheckedChange={setWithCoach}
        label="Include my coach chats in the export"
        description="Left out unless you tick this."
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" icon={Download} onClick={exportJson}>
          Export everything
        </Button>
        <Button variant="neutral" icon={FileSpreadsheet} onClick={exportCsv}>
          Export logs as CSV
        </Button>
      </div>
      <div className="grid gap-2 border-t-2 border-dashed border-ink-4 pt-4">
        <p className="max-w-[56ch] text-body-sm text-ink-2">{YOUR_DATA.deleteHint}</p>
        <div>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirming(true)}>
            Delete everything
          </Button>
        </div>
      </div>
      {status}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete everything on this device?"
        description={YOUR_DATA.confirm}
        confirmLabel="Delete everything"
        cancelLabel="Keep my data"
        destructive
        onConfirm={remove}
      />
    </Card>
  );
}
