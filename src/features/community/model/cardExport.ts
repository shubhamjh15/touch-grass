import { captureWorld } from '@/world';
import {
  CARD_SIZE,
  FONT_STACKS,
  cardCaption,
  cardFileName,
  cardToSvg,
  canvasMeasure,
  drawCard,
  estimateWidth,
  layoutCard,
  readPalette,
  type CardFacts,
  type CardFormat,
  type CardImage,
  type CardLayout,
  type CardOptions,
  type Measure,
} from './shareCard';

/** How long the page waits for the world to hand over a picture before it draws its own tree. */
export const CAPTURE_TIMEOUT_MS = 6000;

/** The picture box of each format, so the capture is taken at the shape it will be cropped to. */
export const PICTURE_BOX: Readonly<Record<CardFormat, { width: number; height: number }>> = {
  story: { width: 888, height: 1010 },
  square: { width: 888, height: 360 },
};

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

/** The 3D world as a picture, or `null` when there is no WebGL, no stage, or it takes too long. */
export async function captureWorldImage(format: CardFormat): Promise<CardImage | null> {
  try {
    const blob = await Promise.race([
      captureWorld(PICTURE_BOX[format]),
      timeout(CAPTURE_TIMEOUT_MS, null),
    ]);
    if (!blob) return null;
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    }
    return null;
  } catch {
    return null;
  }
}

let fontsReady: Promise<void> | null = null;

/** The three brand fonts, loaded, so the canvas draws the same lettering as the page. */
export function ensureCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsReady ??= Promise.race([
    Promise.all([
      document.fonts.load(`400 64px ${FONT_STACKS.display}`),
      document.fonts.load(`700 36px ${FONT_STACKS.sans}`),
      document.fonts.load(`500 28px ${FONT_STACKS.mono}`),
    ]).then(() => undefined),
    timeout(2500, undefined),
  ]).catch(() => undefined);
  return fontsReady;
}

let probe: CanvasRenderingContext2D | null | undefined;

/** A 2D context for measuring text, or `null` when canvas is not available at all. */
function measuringContext(): CanvasRenderingContext2D | null {
  if (probe !== undefined) return probe;
  try {
    probe = document.createElement('canvas').getContext('2d');
  } catch {
    probe = null;
  }
  return probe;
}

/** True when a PNG can be drawn here. */
export function canDrawPng(): boolean {
  return measuringContext() !== null;
}

export function currentMeasure(): Measure {
  const ctx = measuringContext();
  return ctx ? canvasMeasure(ctx) : estimateWidth;
}

export function buildLayout(
  facts: CardFacts,
  options: CardOptions,
  format: CardFormat,
  image: CardImage | null,
): CardLayout {
  return layoutCard(facts, options, format, image !== null, currentMeasure());
}

/** Draws the card to a PNG. Resolves to `null` when the canvas cannot be had or refuses to encode. */
export function renderPng(layout: CardLayout, image: CardImage | null): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      drawCard(ctx, layout, readPalette(), image);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

export function renderSvg(layout: CardLayout): string {
  return cardToSvg(layout, readPalette());
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type ExportOutcome =
  | { ok: true; how: 'shared' | 'downloaded-png' | 'downloaded-svg' }
  | { ok: false; reason: 'cancelled' | 'failed' };

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Whether this browser can hand a PNG file to the system share sheet. */
export function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
    );
  } catch {
    return false;
  }
}

/**
 * Sends the card out: through the share sheet when the browser can share a file, otherwise as a
 * download. When the PNG cannot be drawn the SVG card is saved instead, so the visitor still
 * leaves with a picture.
 */
export async function exportCard(
  layout: CardLayout,
  image: CardImage | null,
  format: CardFormat,
  facts: CardFacts,
): Promise<ExportOutcome> {
  const png = await renderPng(layout, image);
  if (!png) {
    try {
      const svg = new Blob([renderSvg(layout)], { type: 'image/svg+xml' });
      download(svg, cardFileName(format, facts.treeName, 'svg'));
      return { ok: true, how: 'downloaded-svg' };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }
  const file = new File([png], cardFileName(format, facts.treeName, 'png'), { type: 'image/png' });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], text: cardCaption(facts) });
      return { ok: true, how: 'shared' };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' };
      }
      // A share sheet that refuses is no reason to lose the picture: fall through to a download.
    }
  }
  try {
    download(png, file.name);
    return { ok: true, how: 'downloaded-png' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export { CARD_SIZE };
