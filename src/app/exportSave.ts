import { exportFileName, gameActions } from '@/game';

/**
 * Saves the whole game as a file in the browser's downloads. Throws when the export cannot be
 * built. Imported lazily by the error page, so it names exactly what it needs from the game.
 */
export function downloadSave(): void {
  const blob = new Blob([gameActions.exportState()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(Date.now());
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
