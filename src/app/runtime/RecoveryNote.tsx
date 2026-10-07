'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { gameActions, useGameRuntime } from '@/game';
import { Button, TapeNote } from '@/ui';

const COPY = {
  body: "A save from before couldn't be read, so this device started fresh. It was set aside, not deleted.",
  download: 'Download it',
  discard: 'Remove it',
};

function downloadRaw(): void {
  const entry = gameActions.recoveryEntries()[0];
  if (!entry) return;
  const url = URL.createObjectURL(new Blob([entry.raw], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'touch-grass-unreadable-save.txt';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The way to a save that could not be read: says so once, in plain words, and offers the raw
 * file or its removal. Shown where someone lands after it happened (first run) and where data
 * is managed (Me, Data). Takes no room when there is nothing set aside.
 */
export function RecoveryNote({ className }: { className?: string }) {
  const runtime = useGameRuntime();
  // The slot is read once: it only changes through the two buttons below.
  const [stored, setStored] = useState(() => gameActions.recoveryEntries().length > 0);
  if (!stored && !runtime.recovery) return null;

  const discard = () => {
    gameActions.discardRecovery();
    setStored(false);
  };

  return (
    <TapeNote tone="pink" tape="blue" rotate={0} role="status" className={className}>
      <span className="block">{COPY.body}</span>
      <span className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="neutral" size="sm" icon={Download} onClick={downloadRaw}>
          {COPY.download}
        </Button>
        <Button variant="ghost" size="sm" onClick={discard}>
          {COPY.discard}
        </Button>
      </span>
    </TapeNote>
  );
}
