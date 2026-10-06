'use client';

import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Input } from '@/ui';
import { COMMUNITY_COPY } from '../copy';

const COPY = COMMUNITY_COPY.challenge;

export interface LinkBoxProps {
  label: string;
  url: string;
  /** The sentence that travels with the link in a share sheet. */
  shareText: string;
}

/** A link you can read, select, copy or hand to the share sheet. Copy failure says so and leaves the link selectable. */
export function LinkBox({ label, url, shareText }: LinkBoxProps) {
  const [note, setNote] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNote(COPY.linkCopied);
    } catch {
      setNote(COPY.copyFailed);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Touch Grass', text: shareText, url });
      setNote(null);
    } catch (error) {
      // Closing the sheet is a choice, not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNote(COPY.copyFailed);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      <Field label={label}>
        <Input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-data"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="neutral" size="sm" icon={Copy} onClick={copy}>
          {COPY.copyLink}
        </Button>
        {canShare ? (
          <Button variant="neutral" size="sm" icon={Share2} onClick={share}>
            {COPY.shareLink}
          </Button>
        ) : null}
        <p role="status" aria-live="polite" className="min-h-5 text-body-sm text-ink-2">
          {note ?? ''}
        </p>
      </div>
    </div>
  );
}
