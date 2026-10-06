import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACTS } from '@/data/content';
import { gameActions, getGameState } from '@/game';
import { setMotionPreference } from '@/lib/hooks';
import { at, resetGame, seedFixture, type FixtureName } from './testing';
import TodayPage from './TodayPage';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: '',
  openCoach: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => '/today',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The shell's navigation is not on this page; only its page-facing pieces are.
vi.mock('@/app/shell', async () => {
  const routes = await vi.importActual<Record<string, unknown>>('@/app/routes');
  const frame = await vi.importActual<Record<string, unknown>>('@/app/page/PageSection');
  return { ...routes, ...frame, openCoach: nav.openCoach, useHideChrome: () => undefined };
});

// The 3D world is another module's business. Its stage is replaced by a box that keeps the
// contract this page relies on: a label, landmark buttons when asked for, and children.
vi.mock('@/world', () => {
  const LANDMARKS = ['log', 'quests', 'learn', 'impact', 'community', 'coach', 'me'] as const;
  return {
    LANDMARKS,
    getStickingPoint: () => null,
    useWorldStore: (selector: (state: { status: string }) => unknown) =>
      selector({ status: 'ready' }),
    WorldStage: (props: {
      label?: string;
      landmarks?: boolean;
      landmarkMeta?: Record<string, string>;
      onLandmark?: (id: string) => void;
      children?: ReactNode;
    }) => (
      <div role="group" aria-label={props.label} data-world-stage="hub">
        {props.landmarks
          ? LANDMARKS.map((id) => (
              <button key={id} type="button" onClick={() => props.onLandmark?.(id)}>
                landmark {id} {props.landmarkMeta?.[id] ?? ''}
              </button>
            ))
          : null}
        {props.children}
      </div>
    ),
  };
});

function open(name: FixtureName, start?: number) {
  const clock = seedFixture(name, start);
  render(<TodayPage />);
  return clock;
}

const statusLine = () => screen.getByTestId('status-line').textContent;
/** Radix tabs change on pointer down, not on click. */
const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const todaysLogs = () => {
  const state = getGameState();
  return state.logs.filter((log) => log.day === state.clock.today).length;
};

beforeEach(() => {
  // jsdom has no layout: the first-day tour scrolls its target into view.
  Element.prototype.scrollIntoView = vi.fn();
  nav.push.mockClear();
  nav.replace.mockClear();
  nav.openCoach.mockClear();
  nav.search = '';
  // Reduced motion: a tap saves at once instead of after the sticker's flight.
  setMotionPreference('reduced');
});

afterEach(() => {
  setMotionPreference('system');
  resetGame();
});

describe('Today: the tree as text', () => {
  it('names the tree, its species, stage, day, vitality, rings and streak', () => {
    open('day12');
    expect(
      screen.getByRole('group', { name: /Fern, a 12-ring oak sapling, thriving/ }),
    ).toBeInTheDocument();
    const tag = screen.getByRole('link', { name: /Fern/ });
    expect(tag).toHaveAttribute('href', '/me');
    expect(tag).toHaveTextContent('Day 12 · Thriving');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Afternoon, Maya.');
    openTab('This week');
    expect(screen.getByText(/12-day streak · 2 rain days banked · 12 rings/)).toBeInTheDocument();
  });

  it('shows the week as seven marks, each with its name as text', () => {
    open('day45');
    openTab('This week');
    const days = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem');
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveTextContent('Mon');
    expect(days[0]).toHaveTextContent(/Full ring|Ring/);
    expect(days[1]).toHaveAttribute('aria-current', 'date');
    expect(days[6]).toHaveTextContent('Still to come');
  });

  it('prints today’s estimate with the honesty mark and its sum', () => {
    open('day12');
    const ticket = screen.getByRole('group', { name: 'Level, streak and today' });
    expect(ticket).toHaveTextContent('2.3');
    fireEvent.click(within(ticket).getByRole('button', { name: 'About this estimate' }));
    expect(screen.getByText(/2 logged actions today, each quantity × its factor/)).toBeVisible();
  });
});

describe('Today: the daily check-in', () => {
  it('offers Water before the check-in and Log after it', () => {
    open('thirsty');
    expect(statusLine()).toBe('Fern is thirsty. One tap fixes that.');
    expect(screen.queryByRole('link', { name: 'Log an action' })).not.toBeInTheDocument();
    openTab("Today's fact");
    expect(screen.getByText(/turns over when Fern is watered/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Water Fern' }));

    expect(getGameState().tree.vitality).toBe('thriving');
    expect(screen.queryByRole('button', { name: 'Water Fern' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log an action' })).toHaveAttribute('href', '/log');
    expect(statusLine()).toBe("3 more actions close today's ring.");
    expect(screen.getByText('Fern is watered. Ring 19 drawn.')).toBeInTheDocument();
  });

  it('turns the daily fact over with the check-in', () => {
    open('thirsty');
    fireEvent.click(screen.getByRole('button', { name: 'Water Fern' }));
    openTab("Today's fact");
    const fact = screen.getByRole('tabpanel', { name: "Today's fact" });
    const shown = FACTS.find((entry) => fact.textContent?.includes(entry.text));
    expect(shown).toBeDefined();
    expect(within(fact).getByText(`Source: ${shown?.sourceLabel}`)).toBeInTheDocument();
  });

  it('wakes a resting tree with kind words, and keeps every ring', () => {
    open('dormant');
    expect(statusLine()).toBe('Fern is resting. It kept every ring. Wake it up?');
    const rings = getGameState().tree.rings;

    fireEvent.click(screen.getByRole('button', { name: 'Wake Fern up' }));

    expect(getGameState().tree.rings).toBe(rings + 1);
    expect(statusLine()).toBe("Waking up. Close today's ring and it's thriving again.");
  });

  it('rolls into the next day at midnight without a reload', () => {
    const clock = open('day12');
    expect(screen.queryByRole('button', { name: 'Water Fern' })).not.toBeInTheDocument();
    expect(statusLine()).toBe("1 more action closes today's ring.");

    act(() => clock.set(at(0, 5, 1)));

    expect(screen.getByRole('button', { name: 'Water Fern' })).toBeInTheDocument();
    expect(statusLine()).toBe('Fern could use a drink.');
    expect(screen.getByRole('link', { name: /Fern/ })).toHaveTextContent('Day 13');
  });
});

describe('Today: one-tap stickers', () => {
  it('logs with one tap, and the day follows', () => {
    open('day12');
    const row = screen.getByRole('region', { name: 'Stick one on' });
    expect(within(row).getAllByRole('button')).toHaveLength(6);
    const before = todaysLogs();

    fireEvent.click(within(row).getByRole('button', { name: /Veggie meal/ }));

    expect(todaysLogs()).toBe(before + 1);
    const logged = getGameState().logs.at(-1);
    expect(logged).toMatchObject({ actionId: 'plant-based-meal', source: 'quick', qty: 1 });
    expect(statusLine()).toBe('Ring closed. See you tomorrow?');
  });

  it('says what a tap will log, and how much that is', () => {
    open('day12');
    const sticker = screen.getByRole('button', { name: /Walked or cycled/ });
    expect(sticker).toHaveAccessibleDescription(
      /Walked or cycled instead of driving, 5 km, about 1 kg CO2e avoided compared with/,
    );
  });

  it('holds back a sticker the day cannot take, and says why', () => {
    open('day12');
    const before = todaysLogs();
    const blocked = screen.getByRole('button', { name: /Veggie day/ });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(blocked);
    expect(todaysLogs()).toBe(before);
  });

  it('follows an undo: the day goes back to how it was', () => {
    open('day12');
    fireEvent.click(screen.getByRole('button', { name: /Veggie meal/ }));
    const logged = getGameState().logs.at(-1);
    expect(statusLine()).toBe('Ring closed. See you tomorrow?');

    act(() => {
      gameActions.undoLog(logged?.id ?? '');
    });

    expect(statusLine()).toBe("1 more action closes today's ring.");
  });

  it('links to the whole catalogue', () => {
    open('day12');
    expect(screen.getByRole('link', { name: /All 51/ })).toHaveAttribute('href', '/log');
  });
});

describe('Today: one next step and recent activity', () => {
  it('has exactly one primary action, and it follows the day', () => {
    open('day12');
    const dock = within(screen.getByRole('region', { name: 'Today' }));
    expect(dock.getByRole('link', { name: 'Log an action' })).toHaveAttribute('href', '/log');
    expect(dock.queryByRole('button', { name: /Water/ })).not.toBeInTheDocument();
    expect(dock.getByRole('progressbar', { name: "Today's ring" })).toHaveAttribute(
      'aria-valuetext',
      '2 of 3 actions',
    );
  });

  it('lists what was logged today, newest first, each with its estimate explained', () => {
    open('day12');
    const feed = within(screen.getByRole('region', { name: 'Recent activity' }));
    const rows = within(feed.getByRole('list', { name: 'Logged today' })).getAllByRole('listitem');
    expect(rows).toHaveLength(todaysLogs());
    const newest = getGameState().logs.at(-1);
    expect(rows[0]).toHaveTextContent(String(newest?.qty));
    expect(feed.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/log');

    fireEvent.click(
      within(rows[0] as HTMLElement).getByRole('button', { name: 'About this estimate' }),
    );
    expect(screen.getByText(/Compared with .*careful estimate/)).toBeVisible();
  });

  it('adds a new log to the top of the feed', () => {
    open('day12');
    const feed = within(screen.getByRole('region', { name: 'Recent activity' }));
    fireEvent.click(screen.getByRole('button', { name: /Veggie meal/ }));
    const rows = within(feed.getByRole('list', { name: 'Logged today' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Veggie meal');
  });

  it('says so when nothing has been logged yet', () => {
    open('thirsty');
    const feed = within(screen.getByRole('region', { name: 'Recent activity' }));
    expect(feed.getByText(/Nothing stuck yet today/)).toBeInTheDocument();
    expect(feed.queryByRole('list', { name: 'Logged today' })).not.toBeInTheDocument();
  });
});

describe('Today: quests', () => {
  it('lists the three dailies with their progress, claimable first', () => {
    open('day12');
    const quests = within(screen.getByRole('region', { name: "Today's quests" }));
    const items = quests.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('First light');
    expect(quests.getByText('0 of 3 done')).toBeInTheDocument();
  });

  it('claims a finished quest exactly once', () => {
    open('day12');
    const xpBefore = getGameState().xp;
    const quests = within(screen.getByRole('region', { name: "Today's quests" }));

    fireEvent.click(quests.getByRole('button', { name: /Claim/ }));

    const gained = getGameState().xp - xpBefore;
    expect(gained).toBeGreaterThan(0);
    expect(quests.getByText('1 of 3 done')).toBeInTheDocument();
    expect(quests.getByText(/^Claimed\. Plus \d+ XP\.$/)).toBeInTheDocument();
    expect(quests.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
    expect(gameActions.claimQuest('d_first_light').ok).toBe(false);
    expect(getGameState().xp - xpBefore).toBe(gained);
  });

  it('shows progress move as actions are logged', () => {
    open('day12');
    const quests = within(screen.getByRole('region', { name: "Today's quests" }));
    const rinse = quests
      .getAllByRole('listitem')
      .find((item) => /Quick rinse/.test(item.textContent ?? ''));
    expect(rinse).toBeDefined();
    expect(within(rinse as HTMLElement).queryByRole('button', { name: /Claim/ })).toBeNull();

    act(() => {
      gameActions.logAction({ actionId: 'shorter-shower', qty: 2, source: 'log' });
    });

    const after = quests
      .getAllByRole('listitem')
      .find((item) => /Quick rinse/.test(item.textContent ?? ''));
    expect(within(after as HTMLElement).getByRole('button', { name: /Claim/ })).toBeInTheDocument();
  });
});

describe('Today: Moss, the island and what happened while away', () => {
  it('gives a built-in tip whose chip only opens the Log page prefilled', () => {
    open('day12');
    const note = within(screen.getByRole('region', { name: 'Next up' }));
    expect(note.getByText(/1 more action closes today's ring/)).toBeInTheDocument();
    expect(note.getByText('Built-in coach')).toBeInTheDocument();
    const before = todaysLogs();
    const chip = note.getByRole('link', { name: 'Log: Walked or cycled' });
    expect(chip).toHaveAttribute('href', '/log?a=walk-cycle-instead-of-car&src=coach');
    expect(todaysLogs()).toBe(before);

    fireEvent.click(note.getByRole('button', { name: 'Ask Moss' }));
    expect(nav.openCoach).toHaveBeenCalledTimes(1);
  });

  it('keeps the landmarks behind Explore on a phone, as real buttons in island order', () => {
    open('day12');
    expect(screen.queryByRole('button', { name: /^landmark/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));

    const names = screen
      .getAllByRole('button', { name: /^landmark/ })
      .map((button) => button.textContent?.trim().replace(/\s+/g, ' '));
    expect(names).toEqual([
      'landmark log',
      'landmark quests 0/3',
      'landmark learn',
      'landmark impact 12 rings',
      'landmark community',
      'landmark coach',
      'landmark me',
    ]);
    expect(screen.getByRole('button', { name: 'Turn left' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /landmark impact/ }));
    expect(nav.push).toHaveBeenCalledWith('/impact');
    fireEvent.click(screen.getByRole('button', { name: /landmark coach/ }));
    expect(nav.openCoach).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: /^landmark/ })).not.toBeInTheDocument();
  });

  it('shows each return message once: dismissing it removes it for good', () => {
    open('thirsty');
    const notes = within(screen.getByRole('list', { name: 'While you were away' }));
    expect(notes.getByText(/Your streak rested at 18 days/)).toBeInTheDocument();
    const count = getGameState().notices.length;

    fireEvent.click(notes.getAllByRole('button', { name: 'Dismiss' })[0] as HTMLElement);

    expect(getGameState().notices).toHaveLength(count - 1);
    expect(screen.queryByText(/Your streak rested at 18 days/)).not.toBeInTheDocument();
  });
});

describe('Today: first day and the weekly recap', () => {
  it('starts day one with the first-leaf line, live quests and a three-step tour', () => {
    open('day1');
    expect(statusLine()).toBe('Log one action to give Fern its first leaf.');
    expect(
      within(screen.getByRole('region', { name: "Today's quests" })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Last week' })).not.toBeInTheDocument();

    const tour = within(screen.getByRole('region', { name: 'Quick tour' }));
    expect(tour.getByText(/1 of 3/)).toBeInTheDocument();
    fireEvent.click(tour.getByRole('button', { name: 'Next' }));
    fireEvent.click(tour.getByRole('button', { name: 'Next' }));
    fireEvent.click(tour.getByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('region', { name: 'Quick tour' })).not.toBeInTheDocument();
    expect(getGameState().onboarding.coachMarksSeen).toBe(true);
  });

  it('offers last week’s recap on the first open of a week, until it is put away', () => {
    open('day12');
    const note = within(screen.getByRole('region', { name: 'Last week' }));
    expect(note.getByText("Last week's page is torn off and ready.")).toBeInTheDocument();
    expect(screen.queryByText('7 of 7')).not.toBeInTheDocument();

    fireEvent.click(note.getByRole('button', { name: 'See the recap' }));

    const recap = within(screen.getByRole('dialog', { name: 'Last week, torn off' }));
    expect(recap.getAllByText(/28 Sep – 04 Oct/).length).toBeGreaterThan(0);
    expect(recap.getByText('7 of 7')).toBeInTheDocument();
    expect(recap.getByText('Seedling 22% → Sapling 9%')).toBeInTheDocument();
    expect(recap.getByRole('list', { name: 'Last week' })).toBeInTheDocument();
    expect(recap.getByRole('link', { name: /See this week’s quests/ })).toHaveAttribute(
      'href',
      '/quests',
    );

    fireEvent.click(recap.getByRole('button', { name: 'Put it away' }));

    expect(screen.queryByRole('region', { name: 'Last week' })).not.toBeInTheDocument();
    expect(getGameState().seen.recapWeek).toBe('W2026-09-28');
  });

  it('answers a quiet week with one kind line and three ways back in', () => {
    open('dormant');
    const recap = within(screen.getByRole('region', { name: 'Last week' }));
    expect(
      recap.getByText('Quiet week. Fern waited. Here are three easy ways back in.'),
    ).toBeInTheDocument();
    const ways = recap.getAllByRole('link');
    expect(ways).toHaveLength(3);
    expect(ways[0]).toHaveAttribute('href', '/log?a=plant-based-meal&q=1&src=recap');
  });
});
