import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ISLAND_PROPS, SPECIES, type WorldSnapshot } from './contract';
import { FallbackTree } from './FallbackTree';

/** The seven stages the look-dev sheet shows, as growth values. */
const STAGES = [0, 0.03, 0.1, 0.25, 0.5, 0.75, 1];

const snapshot = (patch: Partial<WorldSnapshot>): WorldSnapshot => ({
  seed: 12,
  species: 'oak',
  growth: 0.5,
  vitality: 1,
  ageDays: 12,
  props: [],
  hour: 12,
  ...patch,
});

const draw = (
  patch: Partial<WorldSnapshot>,
  props: Partial<Parameters<typeof FallbackTree>[0]> = {},
) => render(<FallbackTree snapshot={snapshot(patch)} width={480} height={420} {...props} />);

describe('FallbackTree', () => {
  it('draws nothing until the stage has a size', () => {
    const { container } = render(<FallbackTree snapshot={snapshot({})} width={0} height={0} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  for (const species of SPECIES) {
    it(`draws ${species} through all seven stages, growing a crown on the way`, () => {
      let previous = -1;
      for (const growth of STAGES) {
        const { container, unmount } = draw({ species, growth });
        const svg = container.querySelector('svg');
        expect(svg, `${species} ${growth}`).not.toBeNull();
        expect(svg?.getAttribute('data-world-fallback')).toBe(species);
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        const clumps = Number(svg?.getAttribute('data-clumps'));
        // A tree never shrinks: later stages have at least as many canopy units.
        expect(clumps, `${species} ${growth}`).toBeGreaterThanOrEqual(previous);
        previous = clumps;
        // Every number in the drawing is finite.
        expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
        unmount();
      }
      expect(previous).toBeGreaterThan(3);
    });
  }

  it('is the sticker: one drawing, stacked as shadow, kiss-cut line, margin and art', () => {
    const { container } = draw({});
    const passes = [...container.querySelectorAll('use')].map((use) =>
      use.getAttribute('data-pass'),
    );
    expect(passes).toEqual(['shadow', 'keyline', 'margin', 'art']);
    const hrefs = new Set(
      [...container.querySelectorAll('use')].map((use) => use.getAttribute('href')),
    );
    expect(hrefs.size).toBe(1);
    const [href] = [...hrefs] as [string];
    expect(container.querySelector(`[id="${href.slice(1)}"]`)).not.toBeNull();
    // The shadow is the only pass that is offset, down and to the right.
    const shadow = container.querySelector('use[data-pass="shadow"]');
    expect(Number(shadow?.getAttribute('x'))).toBeGreaterThan(0);
    expect(shadow?.getAttribute('x')).toBe(shadow?.getAttribute('y'));
  });

  it('is deterministic for a snapshot and changes with the seed', () => {
    const first = draw({ seed: 5 }).container.innerHTML;
    const again = draw({ seed: 5 }).container.innerHTML;
    const other = draw({ seed: 6 }).container.innerHTML;
    const strip = (html: string) =>
      html.replace(/_r_\w+_|«\w+»|:r\w+:/g, 'ID').replace(/r[0-9a-z]+-/g, '');
    expect(strip(first).length).toBe(strip(again).length);
    expect(other).not.toBe(first);
  });

  it('reflects vitality in the paint: a resting tree is not the thriving green', () => {
    const fills = (vitality: number) =>
      draw({ vitality })
        .container.innerHTML.match(/#[0-9a-f]{6}/g)
        ?.join(',') ?? '';
    expect(fills(1)).not.toBe(fills(0.5));
    expect(fills(0.5)).not.toBe(fills(0));
    expect(fills(1)).toContain('#4ade80');
  });

  it('grades every tone by the hour', () => {
    const fills = (hour: number) => draw({ hour }).container.innerHTML.match(/#[0-9a-f]{6}/g) ?? [];
    expect(fills(12)).toContain('#4ade80');
    expect(fills(23)).not.toContain('#4ade80');
  });

  it('draws unlocked props and the landmark objects, and hides landmarks in a ceremony', () => {
    const bare = draw({}, { landmarks: false }).container.querySelectorAll(
      'path, rect, ellipse',
    ).length;
    const marked = draw({}).container.querySelectorAll('path, rect, ellipse').length;
    const full = draw({ props: [...ISLAND_PROPS] }).container.querySelectorAll(
      'path, rect, ellipse',
    ).length;
    const ceremony = draw({}, { mode: 'ceremony' }).container.querySelectorAll(
      'path, rect, ellipse',
    ).length;
    expect(marked).toBeGreaterThan(bare);
    expect(full).toBeGreaterThan(marked + 20);
    expect(ceremony).toBeLessThan(marked);
  });

  it('adds a ring to the medallion at each milestone of days', () => {
    const rings = (ageDays: number) =>
      draw({ ageDays }).container.querySelectorAll('ellipse[fill="none"]').length;
    expect(rings(0)).toBe(0);
    expect(rings(1)).toBe(1);
    expect(rings(30)).toBe(3);
    expect(rings(400)).toBe(5);
  });

  it('reports the sticking point inside the box', () => {
    const onPlaced = vi.fn();
    draw({ growth: 0.8 }, { onPlaced });
    expect(onPlaced).toHaveBeenCalled();
    const [{ x, y }] = onPlaced.mock.calls.at(-1) as [{ x: number; y: number }];
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(480);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(420);
  });

  it('keeps the whole sticker inside the box at every size it is given', () => {
    for (const [width, height] of [
      [220, 220],
      [390, 520],
      [960, 640],
    ] as const) {
      const { container } = render(
        <FallbackTree snapshot={snapshot({ growth: 1 })} width={width} height={height} />,
      );
      const xs = [...container.querySelectorAll('ellipse')].map((el) =>
        Number(el.getAttribute('cx')),
      );
      expect(Math.min(...xs)).toBeGreaterThan(0);
      expect(Math.max(...xs)).toBeLessThan(width);
    }
  });
});
