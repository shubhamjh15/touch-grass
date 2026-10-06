import type { ImportPreview } from '@/game';
import { formatNumber, pluralize } from '@/lib/format';

/** Hands a text file to the browser as a download. Throws when the browser refuses; the caller falls back to "Copy as text". */
export function downloadText(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next turn so the download has started before the address disappears.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The biggest file the import will read; a real save is a few hundred kilobytes at most. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ReadResult = { ok: true; text: string } | { ok: false; message: string };

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function readImportFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: 'That file is far too big to be a save. Nothing was changed.' };
  }
  try {
    return { ok: true, text: await readText(file) };
  } catch {
    return { ok: false, message: "That file couldn't be read. Nothing was changed." };
  }
}

/** "48 kB", from a byte count; never below 1 kB so a tiny save does not read as zero. */
export function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} kB`;
}

const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function dayLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  return shortDay.format(new Date(year, month - 1, day));
}

/** "Juniper · 43 rings · 212 logs · 6 Oct – 18 Nov": what an import file holds, before it replaces anything. */
export function describeImport(preview: ImportPreview): string {
  const parts = [
    preview.treeName,
    pluralize(preview.rings, 'ring'),
    pluralize(preview.logs, 'log'),
  ];
  if (preview.firstLogDay && preview.lastLogDay) {
    parts.push(
      preview.firstLogDay === preview.lastLogDay
        ? dayLabel(preview.firstLogDay)
        : `${dayLabel(preview.firstLogDay)} – ${dayLabel(preview.lastLogDay)}`,
    );
  }
  return parts.join(' · ');
}

/** Typing the name is the lock on a reset: case and stray spaces do not matter, the letters do. */
export function matchesTypedName(typed: string, expected: string): boolean {
  const clean = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase();
  return clean(expected) !== '' && clean(typed) === clean(expected);
}

/** The word that unlocks "Replace this device's data". */
export const REPLACE_WORD = 'replace';
