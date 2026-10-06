import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions, getGameState } from '@/game';
import type * as World from '@/world';
import { emitPulse } from '@/world';
import LandingPage from './LandingPage';
import { FAQ, FINAL, HERO, HONEST, HOW, TRY } from './copy';
import { DEMO_ACTIONS } from './model';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The tree is drawn by the world; here only the pulses the page sends it matter.
vi.mock('@/world', async (original) => ({
  ...(await original<typeof World>()),
  emitPulse: vi.fn(),
}));

const sticker = (index: number) => {
  const action = DEMO_ACTIONS[index];
  if (!action) throw new Error(`no demo action ${index}`);
  return screen.getByRole('button', { name: action.label });
};

const stick = (index: number, times = 1) => {
  for (let count = 0; count < times; count += 1) fireEvent.click(sticker(index));
};

const section = (title: string) => {
  const found = screen.getByRole('heading', { name: title }).closest('section');
  if (!found) throw new Error(`section "${title}" missing`);
  return within(found);
};

const pulses = (kind: string) =>
  vi.mocked(emitPulse).mock.calls.filter(([pulse]) => pulse.kind === kind);

const words = (text: string) => text.trim().split(/\s+/).length;

/** The figure a sighted visitor reads (the same text is repeated for screen readers in the status line). */
const VISIBLE = { ignore: '[role="status"]' } as const;

/** Every number printed on the page, leaving out text that only screen readers get. */
const numbersOnScreen = () => {
  const copy = document.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.sr-only').forEach((node) => node.remove());
  return (copy.textContent ?? '').match(/\d+(?:[.,]\d+)?/g) ?? [];
};

beforeEach(() => {
  gameActions.resetAll();
  vi.mocked(emitPulse).mockClear();
});

describe('<LandingPage>', () => {
  it('leads with a short headline, one line of copy and one way to start', () => {
    render(<LandingPage />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(HERO.title);
    expect(words(HERO.title)).toBeLessThanOrEqual(6);
    expect(screen.getByText(HERO.sub)).toBeInTheDocument();

    const hero = section(HERO.title);
    expect(hero.getAllByRole('link')).toHaveLength(1);
    expect(hero.getByRole('link', { name: HERO.action })).toHaveAttribute('href', '/start');
    expect(hero.getByRole('img', { name: HERO.treeLabel })).toBeInTheDocument();
  });

  it('is six sections, each named by its own short heading', () => {
    render(<LandingPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sections = [...document.querySelectorAll('section[aria-labelledby]')];
    const titles = sections.map(
      (node) => document.getElementById(node.getAttribute('aria-labelledby') ?? '')?.textContent,
    );
    expect(titles).toEqual([
      HERO.title,
      HOW.title,
      TRY.title,
      HONEST.title,
      FAQ.title,
      FINAL.title,
    ]);
    for (const title of titles) expect(words(title ?? '')).toBeLessThanOrEqual(6);
  });

  it('explains how it works in three steps of three words each', () => {
    render(<LandingPage />);
    const steps = section(HOW.title).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    HOW.steps.forEach((step, index) => {
      expect(words(step.title)).toBe(3);
      expect(steps[index]).toHaveTextContent(`Step ${index + 1}: ${step.title}`);
      expect(steps[index]).toHaveTextContent(step.line);
    });
  });

  it('grows the demo tree on one tap and shows the real estimate with its honesty mark', () => {
    render(<LandingPage />);
    const demo = section(TRY.title);
    expect(demo.getByText(TRY.hint)).toBeInTheDocument();
    expect(demo.getByRole('status')).toBeEmptyDOMElement();
    expect(demo.getByRole('img', { name: /demo tree.*Stage: Seedling/i })).toBeInTheDocument();

    stick(0);

    expect(pulses('grow')).toHaveLength(1);
    expect(demo.queryByText(TRY.hint)).not.toBeInTheDocument();
    expect(demo.getByText(/1\.5 kg/, VISIBLE)).toHaveTextContent(
      'approximately 1.5 kg CO2e avoided',
    );
    expect(demo.getByRole('button', { name: 'About this estimate' })).toBeInTheDocument();
    expect(demo.getByRole('status')).toHaveTextContent(
      'Plant-based lunch: approximately 1.5 kg CO2e avoided. Demo tree: Seedling.',
    );
  });

  it('shows the estimate of whichever sticker was tapped last', () => {
    render(<LandingPage />);
    const demo = section(TRY.title);
    stick(1);
    expect(demo.getByText(/1 kg/, VISIBLE)).toBeInTheDocument();
    stick(2);
    expect(demo.getByText(/100 g/, VISIBLE)).toBeInTheDocument();
    expect(demo.queryByText(/1 kg/, VISIBLE)).not.toBeInTheDocument();
  });

  it('reaches Sapling after five stickers and celebrates the new stage once', () => {
    render(<LandingPage />);
    const demo = section(TRY.title);
    stick(1, 4);
    expect(demo.getByText('Demo tree · Seedling')).toBeInTheDocument();
    expect(pulses('celebrate')).toHaveLength(0);

    stick(2);

    expect(demo.getByText('Demo tree · Sapling')).toBeInTheDocument();
    expect(demo.getByRole('img', { name: /Stage: Sapling/ })).toBeInTheDocument();
    expect(demo.getByRole('status')).toHaveTextContent('Demo tree: Sapling.');
    expect(pulses('grow')).toHaveLength(5);
    expect(pulses('celebrate')).toHaveLength(1);

    stick(0, 3);
    expect(pulses('celebrate')).toHaveLength(1);
  });

  it('works from the keyboard: the stickers are buttons in reading order', () => {
    render(<LandingPage />);
    const buttons = section(TRY.title).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(
      DEMO_ACTIONS.map((action) => action.label),
    );
    for (const button of buttons) expect(button).not.toHaveAttribute('tabindex', '-1');
  });

  it('says nothing is saved, and saves nothing', () => {
    render(<LandingPage />);
    expect(section(TRY.title).getByText(TRY.note)).toHaveTextContent(/nothing is saved/i);
    const game = JSON.stringify(getGameState());
    const local = { ...localStorage };

    stick(1);
    stick(0, 3);

    expect(JSON.stringify(getGameState())).toBe(game);
    expect({ ...localStorage }).toEqual(local);
    expect(Object.keys(sessionStorage)).toEqual([]);
  });

  it('links the honest numbers to the methodology', () => {
    render(<LandingPage />);
    const honest = section(HONEST.title);
    expect(honest.getByRole('link', { name: HONEST.link })).toHaveAttribute('href', '/methodology');
    expect(honest.getByText(/it is an estimate, not a measurement/)).toBeInTheDocument();
  });

  it('answers four questions in an accordion that opens one at a time', () => {
    render(<LandingPage />);
    const faq = section(FAQ.title);
    expect(FAQ.items).toHaveLength(4);
    const groups = new Set<string | null>();
    for (const item of FAQ.items) {
      const question = faq.getByRole('heading', { name: item.question });
      const details = question.closest('details');
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute('open');
      expect(details).toHaveTextContent(item.answer);
      groups.add(details?.getAttribute('name') ?? null);
    }
    // One shared name makes the browser close the open answer when another one opens.
    expect(groups.size).toBe(1);
    expect(groups.has(null)).toBe(false);
  });

  it('closes with one call to action', () => {
    render(<LandingPage />);
    const closing = section(FINAL.title);
    expect(closing.getAllByRole('link')).toHaveLength(1);
    expect(closing.getByRole('link', { name: FINAL.action })).toHaveAttribute('href', '/start');
  });

  it('never shows more than three numbers, before or after a tap', () => {
    render(<LandingPage />);
    expect(numbersOnScreen().length).toBeLessThanOrEqual(3);
    stick(0);
    stick(2);
    expect(numbersOnScreen().length).toBeLessThanOrEqual(3);
  });

  it('contains nothing the directive or the spec bans', () => {
    render(<LandingPage />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/10,000|join \d|testimonial|trusted by|as seen|live data|users/i);
    expect(text).not.toMatch(/ecoquest/i);
    expect(text).not.toMatch(/\boffset/i);
    // No species switcher, no demo badge, no second way to start in the hero.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText(/demo\s*·\s*sped up/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /logo/i })).not.toBeInTheDocument();
  });
});
