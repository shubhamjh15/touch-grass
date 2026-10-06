import { formatCo2Estimate } from '@/lib/format';
import { clamp01 } from '@/lib/math';

/**
 * The share card, drawn from a short list of shapes. One layout feeds two renderers: the
 * canvas one (PNG, with the brand fonts) and the SVG one that the page falls back to when a
 * canvas cannot be had. Nothing in the card comes from the journal or the starting line.
 */

export type CardFormat = 'story' | 'square';

export const CARD_SIZE: Readonly<Record<CardFormat, { width: number; height: number }>> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export type Species = 'oak' | 'cherry' | 'pine';

export type DotMark = 'full' | 'ring' | 'rain' | 'rest' | 'missed' | 'today' | 'none';

export interface CardFacts {
  treeName: string;
  species: Species;
  speciesLabel: string;
  stage: string;
  /** 0..1, how far the tree has grown. */
  growth: number;
  rings: number;
  level: number;
  levelTitle: string;
  streak: number;
  /** Estimated kg CO2e avoided from sourced factors; the line is left out at zero. */
  kg: number;
  week: readonly { letter: string; mark: DotMark }[];
  name: string;
  host: string;
}

export interface CardOptions {
  streak: boolean;
  kg: boolean;
  week: boolean;
  name: boolean;
}

export const DEFAULT_CARD_OPTIONS: CardOptions = {
  streak: true,
  kg: true,
  week: true,
  name: false,
};

export type Tone =
  | 'ink'
  | 'ink3'
  | 'white'
  | 'paper'
  | 'mat'
  | 'matDeep'
  | 'green'
  | 'greenDeep'
  | 'greenTint'
  | 'blue'
  | 'blueTint'
  | 'yellow'
  | 'yellowTint'
  | 'pink'
  | 'pinkTint'
  | 'bark'
  | 'barkDeep'
  | 'tomato';

/** The CSS custom property each tone reads, and a plain colour name for when none resolves. */
export const TONES: Readonly<Record<Tone, readonly [variable: string, fallback: string]>> = {
  ink: ['--color-ink', 'black'],
  ink3: ['--color-ink-3', 'dimgray'],
  white: ['--color-white', 'white'],
  paper: ['--color-paper', 'ivory'],
  mat: ['--color-mat', 'honeydew'],
  matDeep: ['--color-mat-deep', 'palegreen'],
  green: ['--color-green', 'limegreen'],
  greenDeep: ['--color-green-deep', 'darkgreen'],
  greenTint: ['--color-green-tint', 'honeydew'],
  blue: ['--color-blue', 'cornflowerblue'],
  blueTint: ['--color-blue-tint', 'aliceblue'],
  yellow: ['--color-yellow', 'gold'],
  yellowTint: ['--color-yellow-tint', 'lightyellow'],
  pink: ['--color-pink', 'hotpink'],
  pinkTint: ['--color-pink-tint', 'mistyrose'],
  bark: ['--color-bark', 'peru'],
  barkDeep: ['--color-bark-deep', 'saddlebrown'],
  tomato: ['--color-tomato', 'tomato'],
};

export type Fill = Tone | readonly [top: Tone, bottom: Tone];
export type FontKind = 'display' | 'sans' | 'mono';

export type Shape =
  | {
      t: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      r?: number;
      fill?: Fill;
      stroke?: Tone;
      sw?: number;
    }
  | {
      t: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill?: Fill;
      stroke?: Tone;
      sw?: number;
    }
  | { t: 'poly'; pts: readonly number[]; fill?: Fill; stroke?: Tone; sw?: number }
  | {
      t: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      font: FontKind;
      weight?: number;
      fill: Tone;
      align?: 'start' | 'middle' | 'end';
      /** The text shrinks to fit this width rather than overflow. */
      maxW?: number;
    }
  | { t: 'image'; x: number; y: number; w: number; h: number; r: number };

export interface CardLayout {
  width: number;
  height: number;
  shapes: Shape[];
  /** The box the world picture is cropped into. */
  picture: { x: number; y: number; w: number; h: number };
}

export type Measure = (text: string, size: number, font: FontKind, weight: number) => number;

const AVERAGE_WIDTH: Record<FontKind, number> = { display: 0.56, sans: 0.54, mono: 0.62 };

/** A width guess for when no canvas can measure; generous, so a chip never clips its text. */
export const estimateWidth: Measure = (text, size, font, weight) =>
  text.length * size * AVERAGE_WIDTH[font] * (weight >= 700 ? 1.06 : 1);

export const FONT_STACKS: Readonly<Record<FontKind, string>> = {
  display: '"Tilt Warp Variable", "Space Grotesk Variable", system-ui, sans-serif',
  sans: '"Space Grotesk Variable", system-ui, sans-serif',
  mono: '"Martian Mono Variable", ui-monospace, monospace',
};

const MARGIN = 96;

/** "Day 12 with Fern. Young tree and growing. 🌱" */
export function cardCaption(facts: Pick<CardFacts, 'rings' | 'treeName' | 'stage'>): string {
  return `Day ${facts.rings} with ${facts.treeName}. ${facts.stage} and growing. 🌱`;
}

export function cardFileName(format: CardFormat, treeName: string, ext: 'png' | 'svg'): string {
  const slug =
    treeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tree';
  return `touch-grass-${slug}-${format}.${ext}`;
}

/** What a screen reader hears in place of the card. */
export function cardAlt(facts: CardFacts, options: CardOptions): string {
  const parts = [
    `${facts.treeName}, ${facts.speciesLabel}, ${facts.stage}`,
    `Ring ${facts.rings}`,
    `Level ${facts.level}, ${facts.levelTitle}`,
  ];
  if (options.streak && facts.streak > 0) parts.push(`${facts.streak} day streak`);
  if (options.kg && facts.kg > 0) parts.push('estimated CO2e avoided shown');
  return `Share card preview: ${parts.join(', ')}.`;
}

interface Pen {
  shapes: Shape[];
  measure: Measure;
}

function chip(pen: Pen, x: number, y: number, label: string, fill: Tone, size: number): number {
  const height = Math.round(size * 2.1);
  const width = Math.ceil(pen.measure(label, size, 'sans', 700)) + 56;
  pen.shapes.push(
    { t: 'rect', x: x + 6, y: y + 6, w: width, h: height, r: height / 2, fill: 'ink' },
    { t: 'rect', x, y, w: width, h: height, r: height / 2, fill, stroke: 'ink', sw: 6 },
    {
      t: 'text',
      x: x + width / 2,
      y: y + height / 2 + size * 0.35,
      text: label,
      size,
      font: 'sans',
      weight: 700,
      fill: 'ink',
      align: 'middle',
    },
  );
  return width;
}

function illustration(
  shapes: Shape[],
  box: { x: number; y: number; w: number; h: number },
  species: Species,
  growth: number,
): void {
  const cx = box.x + box.w / 2;
  const groundY = box.y + box.h * 0.8;
  const scale = 0.42 + 0.58 * clamp01(growth);
  const unit = Math.min(box.w, box.h) / 100;
  shapes.push(
    {
      t: 'ellipse',
      cx: box.x + box.w * 0.82,
      cy: box.y + box.h * 0.2,
      rx: unit * 7,
      ry: unit * 7,
      fill: 'yellow',
      stroke: 'ink',
      sw: 6,
    },
    {
      t: 'ellipse',
      cx,
      cy: groundY + unit * 6,
      rx: box.w * 0.34,
      ry: unit * 9,
      fill: 'bark',
      stroke: 'ink',
      sw: 7,
    },
    {
      t: 'ellipse',
      cx,
      cy: groundY,
      rx: box.w * 0.36,
      ry: unit * 10,
      fill: 'green',
      stroke: 'ink',
      sw: 7,
    },
  );
  const trunkW = unit * 7 * (0.6 + 0.4 * scale);
  const trunkH = unit * 34 * scale;
  shapes.push({
    t: 'rect',
    x: cx - trunkW / 2,
    y: groundY - trunkH,
    w: trunkW,
    h: trunkH + unit * 2,
    r: trunkW / 3,
    fill: 'bark',
    stroke: 'ink',
    sw: 6,
  });
  const top = groundY - trunkH;
  const crown = unit * 22 * scale;
  if (species === 'pine') {
    for (let tier = 0; tier < 3; tier += 1) {
      const half = crown * (1.25 - tier * 0.28);
      const base = top + crown * (0.55 + tier * 0.15) - tier * crown * 0.78;
      const apex = base - crown * 1.1;
      shapes.push({
        t: 'poly',
        pts: [cx, apex, cx + half, base, cx - half, base],
        fill: tier === 1 ? 'green' : 'greenTint',
        stroke: 'ink',
        sw: 6,
      });
    }
    return;
  }
  const leaf: Tone = species === 'cherry' ? 'pink' : 'green';
  const light: Tone = species === 'cherry' ? 'pinkTint' : 'greenTint';
  const puffs: readonly (readonly [number, number, number, Tone])[] = [
    [-0.75, 0.1, 0.8, light],
    [0.75, 0.1, 0.8, light],
    [0, -0.55, 1, leaf],
    [-0.3, 0.2, 0.9, leaf],
    [0.35, 0.18, 0.85, leaf],
  ];
  for (const [dx, dy, size, fill] of puffs) {
    shapes.push({
      t: 'ellipse',
      cx: cx + dx * crown,
      cy: top - crown * 0.35 + dy * crown,
      rx: crown * size * 0.9,
      ry: crown * size * 0.8,
      fill,
      stroke: 'ink',
      sw: 6,
    });
  }
}

const DOT_FILL: Readonly<Record<DotMark, Tone>> = {
  full: 'green',
  ring: 'greenTint',
  rain: 'blue',
  rest: 'paper',
  missed: 'white',
  today: 'yellowTint',
  none: 'white',
};

/**
 * Lays the card out. When `hasImage` is true the picture box holds the captured world,
 * otherwise a drawn tree of the same species and size stands in its place.
 */
export function layoutCard(
  facts: CardFacts,
  options: CardOptions,
  format: CardFormat,
  hasImage: boolean,
  measure: Measure = estimateWidth,
): CardLayout {
  const { width, height } = CARD_SIZE[format];
  const story = format === 'story';
  const shapes: Shape[] = [];
  const pen: Pen = { shapes, measure };
  const inner = width - MARGIN * 2;

  shapes.push(
    { t: 'rect', x: 0, y: 0, w: width, h: height, fill: ['blueTint', 'matDeep'] },
    { t: 'rect', x: 56, y: 56, w: width - 80, h: height - 80, r: 64, fill: 'ink' },
    {
      t: 'rect',
      x: 40,
      y: 40,
      w: width - 80,
      h: height - 80,
      r: 64,
      fill: 'white',
      stroke: 'ink',
      sw: 10,
    },
    {
      t: 'text',
      x: MARGIN,
      y: 136,
      text: 'TOUCH GRASS',
      size: 32,
      font: 'mono',
      weight: 600,
      fill: 'ink',
    },
    {
      t: 'text',
      x: width - MARGIN,
      y: 136,
      text: `DAY ${facts.rings}`,
      size: 32,
      font: 'mono',
      weight: 600,
      fill: 'ink3',
      align: 'end',
    },
  );

  const picture = { x: MARGIN, y: 172, w: inner, h: story ? 860 : 280 };
  shapes.push({ t: 'rect', ...picture, r: 44, fill: ['blueTint', 'paper'] });
  if (hasImage) shapes.push({ t: 'image', ...picture, r: 44 });
  else illustration(shapes, picture, facts.species, facts.growth);
  shapes.push({ t: 'rect', ...picture, r: 44, stroke: 'ink', sw: 8 });

  let y = picture.y + picture.h + (story ? 132 : 96);
  shapes.push({
    t: 'text',
    x: MARGIN,
    y,
    text: facts.treeName,
    size: story ? 128 : 80,
    font: 'display',
    fill: 'ink',
    maxW: inner,
  });
  if (options.name && facts.name) {
    y += story ? 62 : 48;
    shapes.push({
      t: 'text',
      x: MARGIN,
      y,
      text: `grown by ${facts.name}`,
      size: story ? 40 : 34,
      font: 'sans',
      weight: 600,
      fill: 'ink3',
      maxW: inner,
    });
  }
  y += story ? 62 : 44;
  shapes.push({
    t: 'text',
    x: MARGIN,
    y,
    text: `${facts.speciesLabel} · ${facts.stage}`,
    size: story ? 46 : 36,
    font: 'sans',
    weight: 500,
    fill: 'ink3',
    maxW: inner,
  });

  y += story ? 54 : 30;
  const chipSize = story ? 36 : 30;
  const chipHeight = Math.round(chipSize * 2.1);
  const labels: { text: string; fill: Tone }[] = [
    { text: `Ring ${facts.rings}`, fill: 'yellow' },
    { text: `Level ${facts.level} · ${facts.levelTitle}`, fill: 'white' },
  ];
  if (options.streak && facts.streak > 0) {
    labels.push({ text: `${facts.streak}-day streak`, fill: 'greenTint' });
  }
  if (options.kg && facts.kg > 0) {
    labels.push({
      text: `≈ ${formatCo2Estimate(facts.kg)} estimated CO2e avoided`,
      fill: 'blueTint',
    });
  }
  let x = MARGIN;
  for (const label of labels) {
    const w = Math.ceil(measure(label.text, chipSize, 'sans', 700)) + 56;
    if (x > MARGIN && x + w > MARGIN + inner) {
      x = MARGIN;
      y += chipHeight + 20;
    }
    x += chip(pen, x, y, label.text, label.fill, chipSize) + 22;
  }
  y += chipHeight;

  if (options.week && facts.week.length > 0) {
    const radius = story ? 38 : 26;
    const step = inner / facts.week.length;
    const cy = y + (story ? 96 : 56);
    facts.week.forEach((day, index) => {
      const cx = MARGIN + step * index + step / 2;
      shapes.push({
        t: 'ellipse',
        cx,
        cy,
        rx: radius,
        ry: radius,
        fill: DOT_FILL[day.mark],
        stroke: 'ink',
        sw: 6,
      });
      shapes.push({
        t: 'text',
        x: cx,
        y: cy + radius + (story ? 42 : 32),
        text: day.letter,
        size: story ? 28 : 24,
        font: 'mono',
        weight: 600,
        fill: 'ink3',
        align: 'middle',
      });
    });
  }

  shapes.push(
    {
      t: 'text',
      x: MARGIN,
      y: height - 100,
      text: facts.host,
      size: 28,
      font: 'mono',
      weight: 500,
      fill: 'ink3',
      maxW: inner / 2,
    },
    {
      t: 'text',
      x: width - MARGIN,
      y: height - 100,
      text: 'Self-reported estimates',
      size: 28,
      font: 'mono',
      weight: 500,
      fill: 'ink3',
      align: 'end',
    },
  );

  return { width, height, shapes, picture };
}

// ── Canvas renderer ────────────────────────────────────────────────────────

export type Palette = Readonly<Record<Tone, string>>;

/** Reads the tone colours from the page's own tokens, so the card is never out of step with the product. */
export function readPalette(): Palette {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  const out = {} as Record<Tone, string>;
  for (const tone of Object.keys(TONES) as Tone[]) {
    const [variable, fallback] = TONES[tone];
    const value = style?.getPropertyValue(variable).trim();
    out[tone] = value ? value : fallback;
  }
  return out;
}

export interface CardImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

function fontString(size: number, font: FontKind, weight: number): string {
  return `${weight} ${size}px ${FONT_STACKS[font]}`;
}

/** A `Measure` backed by a real canvas context, so chips fit the fonts that are actually loaded. */
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (text, size, font, weight) => {
    ctx.font = fontString(size, font, weight);
    return ctx.measureText(text).width;
  };
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function canvasFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  palette: Palette,
  y: number,
  h: number,
): string | CanvasGradient {
  if (typeof fill === 'string') return palette[fill];
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, palette[fill[0]]);
  gradient.addColorStop(1, palette[fill[1]]);
  return gradient;
}

function paint(
  ctx: CanvasRenderingContext2D,
  shape: { fill?: Fill; stroke?: Tone; sw?: number },
  palette: Palette,
  y: number,
  h: number,
): void {
  if (shape.fill) {
    ctx.fillStyle = canvasFill(ctx, shape.fill, palette, y, h);
    ctx.fill();
  }
  if (shape.stroke) {
    ctx.strokeStyle = palette[shape.stroke];
    ctx.lineWidth = shape.sw ?? 6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Draws the layout at `scale` (1 is the export size). */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  layout: CardLayout,
  palette: Palette,
  image: CardImage | null,
  scale = 1,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  for (const shape of layout.shapes) {
    switch (shape.t) {
      case 'rect':
        roundedPath(ctx, shape.x, shape.y, shape.w, shape.h, shape.r ?? 0);
        paint(ctx, shape, palette, shape.y, shape.h);
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
        paint(ctx, shape, palette, shape.cy - shape.ry, shape.ry * 2);
        break;
      case 'poly': {
        ctx.beginPath();
        for (let i = 0; i < shape.pts.length; i += 2) {
          const px = shape.pts[i] as number;
          const py = shape.pts[i + 1] as number;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        paint(ctx, shape, palette, 0, layout.height);
        break;
      }
      case 'text': {
        const weight = shape.weight ?? 400;
        let size = shape.size;
        ctx.font = fontString(size, shape.font, weight);
        if (shape.maxW) {
          const natural = ctx.measureText(shape.text).width;
          if (natural > shape.maxW) {
            size = Math.floor((size * shape.maxW) / natural);
            ctx.font = fontString(size, shape.font, weight);
          }
        }
        ctx.fillStyle = palette[shape.fill];
        ctx.textAlign =
          shape.align === 'middle' ? 'center' : shape.align === 'end' ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
      }
      case 'image': {
        if (!image) break;
        ctx.save();
        roundedPath(ctx, shape.x, shape.y, shape.w, shape.h, shape.r);
        ctx.clip();
        // "Cover": fill the box, crop the overflow, keep the centre.
        const ratio = Math.max(shape.w / image.width, shape.h / image.height);
        const w = image.width * ratio;
        const h = image.height * ratio;
        ctx.drawImage(image.source, shape.x + (shape.w - w) / 2, shape.y + (shape.h - h) / 2, w, h);
        ctx.restore();
        break;
      }
    }
  }
  ctx.restore();
}

// ── SVG renderer (the fallback card) ───────────────────────────────────────

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** The same card as a standalone SVG document. Fonts are system fonts: it must open anywhere. */
export function cardToSvg(layout: CardLayout, palette: Palette): string {
  const defs: string[] = [];
  const body: string[] = [];
  let gradients = 0;
  const fillAttr = (fill: Fill | undefined): string => {
    if (!fill) return 'fill="none"';
    if (typeof fill === 'string') return `fill="${palette[fill]}"`;
    const id = `g${gradients}`;
    gradients += 1;
    defs.push(
      `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette[fill[0]]}"/><stop offset="1" stop-color="${palette[fill[1]]}"/></linearGradient>`,
    );
    return `fill="url(#${id})"`;
  };
  const strokeAttr = (shape: { stroke?: Tone; sw?: number }): string =>
    shape.stroke
      ? `stroke="${palette[shape.stroke]}" stroke-width="${shape.sw ?? 6}" stroke-linejoin="round"`
      : '';
  for (const shape of layout.shapes) {
    switch (shape.t) {
      case 'rect':
        body.push(
          `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.r ?? 0}" ${fillAttr(shape.fill)} ${strokeAttr(shape)}/>`,
        );
        break;
      case 'ellipse':
        body.push(
          `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${fillAttr(shape.fill)} ${strokeAttr(shape)}/>`,
        );
        break;
      case 'poly':
        body.push(
          `<polygon points="${shape.pts.join(' ')}" ${fillAttr(shape.fill)} ${strokeAttr(shape)}/>`,
        );
        break;
      case 'text': {
        const weight = shape.weight ?? 400;
        const family =
          shape.font === 'mono' ? 'ui-monospace, Menlo, monospace' : 'system-ui, Arial, sans-serif';
        const natural = estimateWidth(shape.text, shape.size, shape.font, weight);
        const fit =
          shape.maxW && natural > shape.maxW
            ? ` textLength="${Math.floor(shape.maxW)}" lengthAdjust="spacingAndGlyphs"`
            : '';
        const anchor =
          shape.align === 'middle' ? 'middle' : shape.align === 'end' ? 'end' : 'start';
        body.push(
          `<text x="${shape.x}" y="${shape.y}" font-family="${family}" font-size="${shape.size}" font-weight="${shape.font === 'display' ? 800 : weight}" text-anchor="${anchor}" fill="${palette[shape.fill]}"${fit}>${escapeXml(shape.text)}</text>`,
        );
        break;
      }
      case 'image':
        break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}
