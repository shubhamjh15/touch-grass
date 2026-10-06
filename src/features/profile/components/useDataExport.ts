'use client';

import { useCallback, useState } from 'react';
import { gameActions, exportFileName, useGameNow } from '@/game';
import { toast } from '@/ui';
import { APP_VERSION, COPY } from '../copy';
import { downloadText } from '../model/dataFiles';

export interface DataExport {
  includeCoach: boolean;
  setIncludeCoach: (value: boolean) => void;
  exportJson: () => void;
  exportCsv: () => void;
  /** The text of an export the browser would not save, so it can be copied by hand. */
  fallback: string | null;
  clearFallback: () => void;
}

/**
 * Exporting the save as JSON or the logs as CSV. A browser that refuses the download leaves the
 * text in `fallback` for the "Copy as text" door, so the data is never trapped.
 */
export function useDataExport(): DataExport {
  const now = useGameNow();
  const [includeCoach, setIncludeCoach] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const save = useCallback(
    (text: string, extension: 'json' | 'csv') => {
      const file = exportFileName(now, extension);
      try {
        downloadText(file, text, extension === 'json' ? 'application/json' : 'text/csv');
        setFallback(null);
        toast({ title: COPY.data.exported(file) });
      } catch {
        setFallback(text);
        toast({ title: COPY.data.exportFailed, tone: 'info' });
      }
    },
    [now],
  );

  const exportJson = useCallback(
    () => save(gameActions.exportState({ includeCoach, appVersion: APP_VERSION }), 'json'),
    [includeCoach, save],
  );
  const exportCsv = useCallback(() => save(gameActions.exportLogsCsv(), 'csv'), [save]);
  const clearFallback = useCallback(() => setFallback(null), []);

  return { includeCoach, setIncludeCoach, exportJson, exportCsv, fallback, clearFallback };
}
