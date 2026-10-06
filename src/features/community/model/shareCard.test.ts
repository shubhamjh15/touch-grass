import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_OPTIONS,
  cardCaption,
  cardFileName,
  cardToSvg,
  layoutCard,
  readPalette,
  type CardFacts,
  type Shape,
} from './shareCard';

const FACTS: CardFacts = {
  treeName: 'Fern <b>',
  species: 'oak',
  speciesLabel: 'oak',
  stage: 'Young tree',
  growth: 0.4,
  rings: 12,
  level: 5,
  levelTitle: 'Sprout keeper',
  streak: 9,
  kg: 61.4,
  week: [
    { letter: 'M', mark: 'full' },
    { letter: 'T', mark: 'ring' },
    { letter: 'W', mark: 'missed' },
    { letter: 'T', mark: 'today' },
    { letter: 'F', mark: 'none' },
    { letter: 'S', mark: 'none' },
    { letter: 'S', mark: 'none' },
  ],
  name: 'Maya',
  host: 'touchgrass.example',
};

const texts = (shapes: readonly Shape[]): string[] =>
  shapes.flatMap((shape) => (shape.t === 'text' ? [shape.text] : []));

describe('the share card layout', () => {
  it('is 1080 by 1920 for a story and 1080 square for a square', () => {
    expect(layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'story', false)).toMatchObject({
      width: 1080,
      height: 1920,
    });
    expect(layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'square', false)).toMatchObject({
      width: 1080,
      height: 1080,
    });
  });

  it('always carries the self-reported footer and the tree', () => {
    const lines = texts(layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'square', false).shapes);
    expect(lines).toContain('Self-reported estimates');
    expect(lines).toContain('Fern <b>');
    expect(lines).toContain('oak · Young tree');
    expect(lines).toContain('Ring 12');
  });

  it('leaves out what the visitor switched off, and the name by default', () => {
    const on = texts(layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'story', false).shapes);
    expect(on.some((line) => line.includes('9-day streak'))).toBe(true);
    expect(on.some((line) => line.startsWith('≈ 61 kg'))).toBe(true);
    expect(on.some((line) => line.includes('Maya'))).toBe(false);

    const off = texts(
      layoutCard(FACTS, { streak: false, kg: false, week: false, name: true }, 'story', false)
        .shapes,
    );
    expect(off.some((line) => line.includes('streak'))).toBe(false);
    expect(off.some((line) => line.includes('kg'))).toBe(false);
    expect(off).not.toContain('M');
    expect(off).toContain('grown by Maya');
  });

  it('omits the CO2e line when nothing sourced has been avoided yet', () => {
    const lines = texts(
      layoutCard({ ...FACTS, kg: 0 }, DEFAULT_CARD_OPTIONS, 'story', false).shapes,
    );
    expect(lines.some((line) => line.includes('CO2e'))).toBe(false);
  });

  it('keeps every chip inside the card', () => {
    const layout = layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'square', false);
    for (const shape of layout.shapes) {
      if (shape.t === 'rect') expect(shape.x + shape.w).toBeLessThanOrEqual(layout.width);
    }
  });

  it('reserves the picture box for the world only when there is a picture', () => {
    expect(
      layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'story', true).shapes.some((s) => s.t === 'image'),
    ).toBe(true);
    expect(
      layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'story', false).shapes.some((s) => s.t === 'image'),
    ).toBe(false);
  });

  it('draws the illustrated tree for each species', () => {
    for (const species of ['oak', 'cherry', 'pine'] as const) {
      const layout = layoutCard({ ...FACTS, species }, DEFAULT_CARD_OPTIONS, 'story', false);
      expect(
        layout.shapes.filter((s) => s.t === 'ellipse' || s.t === 'poly').length,
      ).toBeGreaterThan(5);
    }
  });
});

describe('the fallback SVG card', () => {
  it('escapes the tree name so it can never become markup', () => {
    const svg = cardToSvg(layoutCard(FACTS, DEFAULT_CARD_OPTIONS, 'square', false), readPalette());
    expect(svg).toContain('Fern &lt;b&gt;');
    expect(svg).not.toContain('<b>');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });
});

describe('caption and file name', () => {
  it('writes the caption the spec asks for', () => {
    expect(cardCaption(FACTS)).toBe('Day 12 with Fern <b>. Young tree and growing. 🌱');
  });

  it('makes a safe file name', () => {
    expect(cardFileName('story', 'Fern <b>!', 'png')).toBe('touch-grass-fern-b-story.png');
    expect(cardFileName('square', '###', 'svg')).toBe('touch-grass-tree-square.svg');
  });
});
