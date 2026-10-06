'use client';

import { useState } from 'react';
import { gameActions, type ImportPreview } from '@/game';
import { Button, Field, Input, Modal, toast } from '@/ui';
import { COPY } from '../copy';
import { REPLACE_WORD, describeImport, matchesTypedName } from '../model/dataFiles';

/**
 * The last look before an import replaces this device's data: what the file holds, a warning when
 * it was edited outside the app, and a typed word as the lock. The file's text is imported only
 * on confirmation, and a failed import changes nothing.
 */
export function ImportDialog({
  text,
  preview,
  checksumMismatch,
  onClose,
}: {
  text: string;
  preview: ImportPreview;
  checksumMismatch: boolean;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const unlocked = matchesTypedName(typed, REPLACE_WORD);

  const replace = () => {
    const result = gameActions.importState(text);
    if (result.ok) {
      toast({ title: COPY.data.imported(result.preview.treeName) });
      onClose();
    } else {
      setFailure(`${result.message} ${COPY.data.importNothing}`);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={COPY.data.importPreviewTitle}
      description={COPY.data.importWarning}
      size="sm"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            {COPY.data.importCancel}
          </Button>
          <Button
            variant="danger"
            onClick={replace}
            disabledReason={unlocked ? undefined : COPY.data.resetNeedsName}
          >
            {COPY.data.importConfirm}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-md border-2 border-ink bg-paper p-3.5">
          <p className="type-slug text-ink-3">{COPY.data.importPreviewLead}</p>
          <p className="mt-1 text-body font-bold break-words text-ink">{describeImport(preview)}</p>
          {preview.exportedAt ? (
            <p className="mt-1 text-caption text-ink-2">
              {COPY.data.importExportedAt(new Date(preview.exportedAt).toLocaleString())}
            </p>
          ) : null}
        </div>
        {checksumMismatch ? (
          <p
            role="note"
            className="rounded-md border-2 border-ink bg-yellow-tint p-3 text-body-sm font-semibold text-ink"
          >
            {COPY.data.importMismatch}
          </p>
        ) : null}
        <Field label={COPY.data.importTypeLabel(REPLACE_WORD)} error={failure ?? undefined}>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      </div>
    </Modal>
  );
}
