'use client';

import { Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/app/shell';
import { gameActions, useProfile } from '@/game';
import { Button, Field, Input, Modal } from '@/ui';
import { COPY } from '../copy';
import { matchesTypedName } from '../model/dataFiles';
import type { DataExport } from './useDataExport';

/**
 * Reset is the one destructive door: it says what goes, offers an export first, and unlocks only
 * when the tree's name is typed. Afterwards the app starts over from the landing page.
 */
export function ResetDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DataExport;
}) {
  const router = useRouter();
  const profile = useProfile();
  const [typed, setTyped] = useState('');
  const unlocked = matchesTypedName(typed, profile.treeName);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTyped('');
  };

  const reset = () => {
    gameActions.resetAll();
    close(false);
    router.replace(ROUTES.landing);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={COPY.data.resetTitle}
      description={COPY.data.resetCannotUndo}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={() => close(false)}>
            {COPY.data.resetKeep}
          </Button>
          <Button
            variant="danger"
            onClick={reset}
            disabledReason={unlocked ? undefined : COPY.data.resetNeedsName}
          >
            {COPY.data.resetConfirm}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <ul className="grid list-disc gap-1 pl-5 text-body-sm text-ink">
          {COPY.data.resetWhat.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Button
          variant="neutral"
          size="sm"
          icon={Download}
          onClick={data.exportJson}
          className="justify-self-start"
        >
          {COPY.data.resetExportFirst}
        </Button>
        <Field label={COPY.data.resetTypeLabel(profile.treeName)} hint={COPY.data.resetTypeHint}>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>
    </Modal>
  );
}
