import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STAGES, gameActions, getGameState } from '@/game';
import { DEMO_CARRY_KEY, readDemoCarry } from '@/lib/demoCarry';
import { mockDesktop } from '@/ui/testUtils';
import { toast } from '@/ui';
import type * as UiModule from '@/ui';
import { emitPulse, getStickingPoint } from '@/world';
import type * as WorldModule from '@/world';
import LandingPage from './LandingPage';
import { DEMO, FAQ, FINAL, HERO, TIMELAPSE_CAPTIONS } from './copy';
import { DEMO_ACTIONS, TIMELAPSE_FRAMES } from './model';
import { useDemo } from './useDemo';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The world is a canvas elsewhere in the app: here only its pulses matter.
vi.mock('@/world', async (original) => ({
  ...(await original<typeof WorldModule>()),
  emitPulse: vi.fn(),
  getStickingPoint: vi.fn(() => null),
}));

// The receipt toast needs the shell's outlet; the page prints the same receipt inline.
// The page prints it through `toastLater`, which fetches the toast library on first use.
vi.mock('@/ui', async (original) => {
  const toast = vi.fn();
  return { ...(await original<typeof UiModule>()), toast, toastLater: toast };
});

const sticker = (index: number) => {
  const action = DEMO_ACTIONS[index];
  if (!action) throw new Error(`no demo action ${index}`);
  return screen.getByRole('button', { name: action.label });
};

const stick = (index: number, times = 1) => {
  for (let count = 0; count < times; count += 1) fireEvent.click(sticker(index));
};

/** Where the demo answers: status line, receipt and the offer to plant. */
const demoSection = () => within(screen.getByRole('group', { name: DEMO.readoutLabel }));

beforeEach(() => {
  gameActions.resetAll();
  vi.mocked(emitPulse).mockClear();
  vi.mocked(toast).mockClear();
});

describe('useDemo', () => {
  it('counts a flying sticker once, however often its flight reports landing', () => {
    vi.mocked(getStickingPoint).mockReturnValue({ x: 120, y: 160 });
    const onLand = vi.fn();
    const { result } = renderHook(() => useDemo(onLand));
    const action = DEMO_ACTIONS[0];
    if (!action) throw new Error('no demo action');

    act(() => result.current.stick(action, document.body));
    const flight = result.current.flights[0];
    if (!flight) throw new Error('the sticker did not take off');
    expect(flight.to).toEqual({ x: 120, y: 160 });
    // In the air: nothing has grown yet.
    expect(result.current.taps).toBe(0);

    act(() => result.current.landFlight(flight.key));
    act(() => result.current.landFlight(flight.key));
    act(() => result.current.endFlight(flight.key));

    expect(result.current.taps).toBe(1);
    expect(onLand).toHaveBeenCalledTimes(1);
    expect(result.current.flights).toHaveLength(0);
    expect(result.current.tally).toEqual([{ action, count: 1 }]);
    vi.mocked(getStickingPoint).mockReturnValue(null);
  });
});

describe('<LandingPage> as server HTML', () => {
  it('carries the whole story as text, with a still tree where the world will be', () => {
    const html = renderToString(<LandingPage />);
    const page = document.createElement('div');
    page.innerHTML = html;
    const text = page.textContent ?? '';

    expect(page.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Grow a living tree by shrinking your footprint.',
    );
    expect(text).toContain(HERO.sub);
    expect(page.querySelector('a[href="/start"]')).toHaveTextContent(HERO.primary);
    for (const item of FAQ.items) expect(text).toContain(item.answer);
    for (const frame of TIMELAPSE_FRAMES) expect(text).toContain(TIMELAPSE_CAPTIONS[frame.id].body);
    // No world on the server: the stage boxes hold the illustrated poster instead.
    expect(page.querySelector('[data-world-stage]')).toBeNull();
    expect(page.querySelectorAll('svg[viewBox="0 0 96 104"]').length).toBeGreaterThan(0);
  });
});

describe('<LandingPage>', () => {
  it('leads with the headline, the pitch and a way to start', () => {
    render(<LandingPage />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Grow a living tree by shrinking your footprint.',
    );
    expect(screen.getByText(HERO.sub)).toBeInTheDocument();
    const plant = screen.getAllByRole('link', { name: HERO.primary });
    expect(plant.length).toBeGreaterThanOrEqual(1);
    for (const link of plant) expect(link).toHaveAttribute('href', '/start');
  });

  it('has exactly one h1 and a labelled heading for every section', () => {
    render(<LandingPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sections = document.querySelectorAll('section[aria-labelledby]');
    expect(sections.length).toBeGreaterThanOrEqual(9);
    sections.forEach((section) => {
      const id = section.getAttribute('aria-labelledby') ?? '';
      expect(document.getElementById(id)?.tagName, id).toBe('H2');
    });
  });

  it('grows the demo tree on one tap and prints the real estimate', () => {
    render(<LandingPage />);
    const demo = demoSection();
    expect(demo.getByRole('status')).toHaveTextContent(DEMO.hint);
    expect(demo.getByText(DEMO.receiptEmpty)).toBeInTheDocument();

    stick(0);

    expect(demo.getByRole('status')).toHaveTextContent(
      'Demo tree: Seedling. 4 more stickers to Sapling.',
    );
    expect(emitPulse).toHaveBeenCalledWith(expect.objectContaining({ kind: 'grow' }));
    expect(demo.getByText(DEMO.receiptTitle)).toBeInTheDocument();
    expect(demo.getByText(/1\.5 kg/, { selector: 'dd' })).toBeInTheDocument();
    expect(demo.getByText(/avoided vs\. a typical meal with meat/)).toBeInTheDocument();
    expect(demo.getByRole('button', { name: 'About this estimate' })).toBeInTheDocument();
  });

  it('adds a receipt toast only while the inline receipt is off screen', () => {
    render(<LandingPage />);
    const box = document.getElementById('try-it');
    if (!box) throw new Error('readout missing');

    // Below the fold, as on a phone at the top of the page.
    box.getBoundingClientRect = () => ({ top: 900, bottom: 1100 }) as DOMRect;
    stick(0);
    expect(toast).toHaveBeenCalledTimes(1);

    // In view, as beside the desktop stage: the inline receipt is enough.
    box.getBoundingClientRect = () => ({ top: 300, bottom: 500 }) as DOMRect;
    stick(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('reaches Sapling after five stickers and celebrates the stage once', () => {
    render(<LandingPage />);
    stick(1, 4);
    expect(demoSection().getByRole('status')).toHaveTextContent('One more sticker to Sapling.');
    expect(emitPulse).not.toHaveBeenCalledWith({ kind: 'celebrate' });

    stick(2);

    expect(demoSection().getByRole('status')).toHaveTextContent('Demo tree: Sapling.');
    expect(vi.mocked(emitPulse).mock.calls.filter(([pulse]) => pulse.kind === 'grow')).toHaveLength(
      5,
    );
    expect(
      vi.mocked(emitPulse).mock.calls.filter(([pulse]) => pulse.kind === 'celebrate'),
    ).toHaveLength(1);
    expect(demoSection().getByText('Biked 5 km, 4 times')).toBeInTheDocument();
  });

  it('puts the stickers under their own heading, and "Try it first" on the first one', () => {
    render(<LandingPage />);
    const tray = screen.getByRole('heading', { level: 2, name: DEMO.title }).closest('section');
    if (!tray) throw new Error('sticker tray missing');
    expect(within(tray).getAllByRole('button')).toHaveLength(DEMO_ACTIONS.length);

    const tryIt = screen.getByRole('link', { name: HERO.secondary });
    // Without JavaScript the link is a plain jump to the demo's readout.
    expect(tryIt).toHaveAttribute('href', '#try-it');
    expect(document.getElementById('try-it')).toBeInTheDocument();
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(tryIt);
    expect(sticker(0)).toHaveFocus();
  });

  it('offers to plant for real after the third sticker, not before', () => {
    render(<LandingPage />);
    stick(0, 2);
    expect(screen.queryByText(/This one's a demo/)).not.toBeInTheDocument();
    stick(1);
    expect(screen.getByText(/This one's a demo/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: DEMO.noteAction })).toHaveAttribute('href', '/start');
  });

  it('never touches saved game state, and saves only the carry for onboarding', () => {
    render(<LandingPage />);
    const before = JSON.stringify(getGameState());
    const stored = { ...localStorage };

    stick(1);
    stick(0);

    expect(JSON.stringify(getGameState())).toBe(before);
    expect({ ...localStorage }).toEqual(stored);
    expect(Object.keys(sessionStorage)).toEqual([DEMO_CARRY_KEY]);
    // The first sticker is the one offered as the real first log.
    expect(readDemoCarry()).toEqual({
      species: 'oak',
      actionId: 'walk-cycle-instead-of-car',
      qty: 5,
    });
  });

  it('carries the species the visitor picked', () => {
    render(<LandingPage />);
    stick(2);
    const picker = screen.getAllByRole('radiogroup', { name: DEMO.speciesLabel })[0];
    if (!picker) throw new Error('species picker missing');
    fireEvent.click(within(picker).getByRole('radio', { name: 'Cherry' }));
    expect(readDemoCarry()).toEqual({ species: 'cherry', actionId: 'shorter-shower', qty: 2 });
    expect(screen.getAllByRole('group', { name: /demo cherry tree/i }).length).toBeGreaterThan(0);
  });

  it('restores the species from a carry left earlier in this tab', async () => {
    sessionStorage.setItem(
      DEMO_CARRY_KEY,
      JSON.stringify({ v: 1, species: 'pine', actionId: null, qty: null }),
    );
    render(<LandingPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('group', { name: /demo pine tree/i }).length).toBeGreaterThan(0),
    );
  });

  it('ignores a damaged carry', () => {
    sessionStorage.setItem(DEMO_CARRY_KEY, '{"v":1,"species":"triffid"');
    render(<LandingPage />);
    expect(screen.getAllByRole('group', { name: /demo oak tree/i }).length).toBeGreaterThan(0);
    stick(0);
    expect(readDemoCarry()).toEqual({ species: 'oak', actionId: 'plant-based-meal', qty: 1 });
  });

  it('tells the time-lapse with the real stage names, every caption in the page', () => {
    render(<LandingPage />);
    const names = STAGES.map(([name]) => name as string);
    const list = screen.getByRole('heading', { name: 'A first year, sped up' }).closest('section');
    if (!list) throw new Error('time-lapse section missing');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(TIMELAPSE_FRAMES.length);
    TIMELAPSE_FRAMES.forEach((frame, index) => {
      const item = items[index];
      if (!item) throw new Error(`caption ${index} missing`);
      expect(names).toContain(frame.stage);
      expect(item).toHaveTextContent(frame.stage);
      expect(item).toHaveTextContent(TIMELAPSE_CAPTIONS[frame.id].title);
    });
    expect(items[0]).toHaveAttribute('aria-current', 'step');
  });

  it('scrubs the time-lapse with the scroll position, forwards and back', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    render(<LandingPage />);
    const section = screen
      .getByRole('heading', { name: 'A first year, sped up' })
      .closest('section');
    if (!section) throw new Error('time-lapse section missing');
    const items = within(section).getAllByRole('listitem');
    let top = 400;
    section.getBoundingClientRect = () =>
      ({ top, height: 2000, bottom: top + 2000, left: 0, right: 390, width: 390 }) as DOMRect;

    const scrollTo = async (next: number) => {
      top = next;
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      });
    };

    await scrollTo(-1200);
    expect(items[7]).toHaveAttribute('aria-current', 'step');
    expect(within(section).getAllByText('Year 1 · Grand tree').length).toBeGreaterThan(1);

    await scrollTo(-600);
    const middle = items.findIndex((item) => item.getAttribute('aria-current') === 'step');
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(6);

    await scrollTo(0);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(within(section).getAllByText('Day 1 · Seed').length).toBeGreaterThan(1);
  });

  it('uses one shared stage for the story on desktop and hands it to the time-lapse', async () => {
    mockDesktop();
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    render(<LandingPage />);
    // The story stage and the closing stage: the phone-only slots stay empty.
    expect(document.querySelectorAll('[data-world-stage="hero"]')).toHaveLength(2);
    expect(screen.getAllByRole('group', { name: /demo oak tree/i })).toHaveLength(2);
    // The sticker tray rides on the story stage, with the species picker beside it.
    const storyStage = document.querySelector<HTMLElement>('[data-world-stage="hero"]');
    if (!storyStage) throw new Error('story stage missing');
    expect(within(storyStage).getAllByRole('button', { name: /lunch|Biked|shower/ })).toHaveLength(
      DEMO_ACTIONS.length,
    );
    expect(
      within(storyStage).getByRole('radiogroup', { name: DEMO.speciesLabel }),
    ).toBeInTheDocument();
    // The illustrated tree does not turn, so nothing says it does.
    expect(screen.queryByText(DEMO.dragHint)).not.toBeInTheDocument();

    const list = screen
      .getByRole('heading', { name: 'A first year, sped up' })
      .closest('section')
      ?.querySelector('ol');
    if (!list) throw new Error('caption list missing');
    // Eight rows of 300 px with the fifth one centred in a 900 px viewport.
    list.getBoundingClientRect = () =>
      ({ top: 450 - 4.5 * 300, height: 2400, bottom: 0, left: 0, right: 0, width: 500 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() =>
      expect(
        screen.getByRole('group', { name: /first year\. Stage: Young tree/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Day 33 · Young tree').length).toBeGreaterThan(1);
  });

  it('answers the six questions and links the honest numbers to the methodology', () => {
    render(<LandingPage />);
    expect(FAQ.items).toHaveLength(6);
    for (const item of FAQ.items) {
      expect(screen.getByRole('heading', { name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
    const methodology = screen.getAllByRole('link', { name: /See every number and source/ });
    for (const link of methodology) expect(link).toHaveAttribute('href', '/methodology');
    expect(screen.getAllByRole('link', { name: 'Open methodology' })[0]).toHaveAttribute(
      'href',
      '/methodology#action-walk-cycle-instead-of-car',
    );
  });

  it('only says "the tree you just grew" once a tree was grown', () => {
    render(<LandingPage />);
    const closing = () => screen.getByRole('heading', { level: 2, name: /Grow one|Keep the tree/ });
    expect(closing()).toHaveTextContent(FINAL.freshLines.join(''));
    stick(0);
    expect(closing()).toHaveTextContent(FINAL.grownLines.join(''));
  });

  it('labels the demo tree as a sped-up demo, in full, at every width', () => {
    render(<LandingPage />);
    // The second half is only hidden visually on the narrowest phones; it stays in the text.
    const tags = screen.getAllByText((_, node) => node?.textContent === 'Demo · sped up');
    expect(tags.length).toBeGreaterThan(0);
  });

  it('sets the unit with a real subscript wherever the copy names it', () => {
    render(<LandingPage />);
    const line = screen.getByText(/Nobody can feel/);
    expect(line).toHaveTextContent(/of CO2e\.$/);
    expect(line.querySelector('sub')).toHaveTextContent('2');
    // No sentence on the page is left with the unit typed flat.
    const flat = [...document.body.querySelectorAll('p, h3, li')].filter((node) =>
      [...node.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && /CO2e/.test(child.textContent ?? ''),
      ),
    );
    expect(flat.map((node) => node.textContent)).toEqual([]);
  });

  it('lets the tour card that peeks in at the edge of a phone show itself', () => {
    const watched: { node: Element; threshold: number; enter: () => void }[] = [];
    class Watcher {
      private readonly threshold: number;
      constructor(
        private readonly callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.threshold = typeof options?.threshold === 'number' ? options.threshold : 0;
      }
      observe(node: Element) {
        watched.push({
          node,
          threshold: this.threshold,
          enter: () =>
            this.callback(
              [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            ),
        });
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', Watcher);
    // Everything starts below the fold, as the tour does on a real phone.
    const below = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 5000, bottom: 5400, left: 0, right: 320 } as DOMRect);

    try {
      render(<LandingPage />);
      const card = screen.getByRole('heading', { level: 3, name: 'Learn' }).closest('li');
      if (!card) throw new Error('the Learn card is not a list item');
      expect(card).toHaveAttribute('data-reveal', 'armed');
      const entry = watched.find((item) => item.node === card);
      if (!entry) throw new Error('the Learn card is not being watched');
      // About a tenth of the next card shows beside the first: that must be enough.
      expect(entry.threshold).toBeLessThanOrEqual(0.05);
      act(() => entry.enter());
      expect(card).toHaveAttribute('data-reveal', 'in');
    } finally {
      below.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('contains nothing the spec bans: no crowds, counters, testimonials or live claims', () => {
    render(<LandingPage />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/10,000|join \d|testimonial|trusted by|as seen|live data|users/i);
    expect(text).not.toMatch(/ecoquest/i);
    expect(text).not.toMatch(/\boffset\b(?!\.)/i);
    expect(screen.queryByRole('img', { name: /logo/i })).not.toBeInTheDocument();
  });
});
