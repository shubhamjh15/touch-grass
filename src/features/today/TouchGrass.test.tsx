import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions, getGameState } from '@/game';
import { formatTime } from '@/lib/format';
import { setMotionPreference } from '@/lib/hooks';
import { BREAK_COPY } from './copy';
import { at, resetGame, seedFixture, type FixtureName, type TestClock } from './testing';
import TodayPage from './TodayPage';

vi.setConfig({ testTimeout: 20_000 });

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '', hideChrome: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
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

vi.mock('@/app/shell', async () => {
  const routes = await vi.importActual<Record<string, unknown>>('@/app/routes');
  const frame = await vi.importActual<Record<string, unknown>>('@/app/page/PageSection');
  return { ...routes, ...frame, openCoach: vi.fn(), useHideChrome: nav.hideChrome };
});

vi.mock('@/world', () => ({
  LANDMARKS: [],
  getStickingPoint: () => null,
  useWorldStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: 'ready' }),
  WorldStage: (props: { label?: string; children?: ReactNode }) => (
    <div role="group" aria-label={props.label}>
      {props.children}
    </div>
  ),
}));

function open(name: FixtureName = 'day12'): TestClock {
  const clock = seedFixture(name);
  render(<TodayPage />);
  return clock;
}

/** Leaves the screen for `minutes`: the page is hidden, time passes, the page comes back. */
function goOutside(clock: TestClock, minutes: number): void {
  act(() => {
    gameActions.signalTouchGrass('hidden');
    clock.advanceMinutes(minutes);
    gameActions.signalTouchGrass('visible');
  });
}

/** Stays on the screen for `minutes`, touching it all the while. */
function stayOnScreen(clock: TestClock, minutes: number): void {
  act(() => {
    for (let minute = 0; minute < minutes * 2; minute += 1) {
      clock.set(clock.now + 30_000);
      gameActions.signalTouchGrass('input');
    }
  });
}

function startBreak(minutes: number): void {
  fireEvent.click(screen.getAllByRole('button', { name: BREAK_COPY.start })[0] as HTMLElement);
  const sheet = within(screen.getByRole('dialog', { name: BREAK_COPY.slug }));
  fireEvent.click(sheet.getByRole('radio', { name: `${minutes} min` }));
  fireEvent.click(sheet.getByRole('button', { name: BREAK_COPY.startNow }));
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  nav.replace.mockClear();
  nav.hideChrome.mockClear();
  nav.search = '';
  setMotionPreference('reduced');
});

afterEach(() => {
  setMotionPreference('system');
  resetGame();
});

describe('Touch grass: starting', () => {
  it('opens from /today?break=20 with that length chosen, then tidies the URL', () => {
    nav.search = 'break=20';
    open();
    const sheet = within(screen.getByRole('dialog', { name: BREAK_COPY.slug }));
    expect(sheet.getByRole('radio', { name: '20 min' })).toBeChecked();
    expect(sheet.getByTestId('break-reward')).toHaveTextContent(/^\+25 XP · \+2 sunlight/);
    expect(nav.replace).toHaveBeenCalledWith('/today', { scroll: false });
  });

  it('prints the engine’s rules before the break starts', () => {
    open();
    fireEvent.click(screen.getAllByRole('button', { name: BREAK_COPY.start })[0] as HTMLElement);
    const sheet = within(screen.getByRole('dialog', { name: BREAK_COPY.slug }));
    expect(sheet.getByRole('radio', { name: '10 min' })).toBeChecked();
    expect(sheet.getByTestId('break-reward')).toHaveTextContent(/^\+15 XP/);
    expect(sheet.getByText(/away from the screen for at least 70% of it/)).toBeInTheDocument();
    expect(sheet.getByText(/No GPS, no step counter, no camera/)).toBeInTheDocument();
    expect(sheet.getByText(/Only if it's safe and you're up for it/)).toBeInTheDocument();
  });

  it('shows the return time instead of the page, and asks the shell to step aside', () => {
    const clock = open();
    startBreak(20);

    expect(getGameState().activeBreak).toMatchObject({ plannedMin: 20, startTs: clock.now });
    expect(heading()).toBe(`Back at ${formatTime(clock.now + 20 * 60_000)}`);
    expect(screen.getByText('Phone down. Sky up. Fern will keep an eye on things.')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Stick one on' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore' })).not.toBeInTheDocument();
    expect(nav.hideChrome).toHaveBeenLastCalledWith(true);
  });

  it('keeps a running break through a reload', () => {
    const clock = open();
    startBreak(30);
    const endsAt = clock.now + 30 * 60_000;
    screen.getByRole('heading', { level: 1 });

    act(() => clock.advanceMinutes(5));
    // A reload is a fresh page over the same saved state.
    render(<TodayPage />);

    expect(screen.getAllByRole('heading', { level: 1 })[1]).toHaveTextContent(
      `Back at ${formatTime(endsAt)}`,
    );
  });
});

describe('Touch grass: coming back', () => {
  it('pays the first kept break of the day and counts it as the check-in', () => {
    const clock = open('thirsty');
    const before = getGameState();
    expect(before.tree.vitality).toBe('thirsty');
    startBreak(10);

    goOutside(clock, 10);
    expect(heading()).toBe("Time's up.");
    expect(screen.queryByRole('button', { name: BREAK_COPY.endEarly })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    expect(heading()).toBe(BREAK_COPY.returnTitle);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));

    const after = getGameState();
    expect(heading()).toBe('10 minutes, kept.');
    expect(
      screen.getByText('+15 XP · Fern soaked up the sun you brought back.'),
    ).toBeInTheDocument();
    expect(after.activeBreak).toBeNull();
    expect(after.breaks.at(-1)).toMatchObject({
      kept: true,
      keptMin: 10,
      outcome: 'outside',
      xp: 15,
    });
    // +15 for the break and +10 for the check-in it performed; a first-break badge adds its own.
    expect(after.xp - before.xp).toBeGreaterThanOrEqual(25);
    expect(after.days[after.clock.today]).toMatchObject({ breakRewarded: true });
    expect(after.tree.vitality).toBe('thriving');
    expect(after.tree.rings).toBe(before.tree.rings + 1);

    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.done }));
    expect(screen.getByTestId('status-line')).toHaveTextContent(
      "3 more actions close today's ring.",
    );
  });

  it('rewards resting off-screen exactly like going outside', () => {
    const clock = open();
    const xp = getGameState().xp;
    startBreak(20);
    goOutside(clock, 20);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.rested }));

    expect(getGameState().xp - xp).toBeGreaterThanOrEqual(25);
    expect(getGameState().breaks.at(-1)).toMatchObject({
      kept: true,
      outcome: 'rested',
      keptMin: 20,
      xp: 25,
    });
  });

  it('records nothing for "didn’t really take a break", and is kind about it', () => {
    const clock = open();
    const before = getGameState();
    startBreak(10);
    goOutside(clock, 10);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.none }));

    expect(screen.getByText(BREAK_COPY.noneReply)).toBeInTheDocument();
    expect(getGameState().breaks).toHaveLength(before.breaks.length);
    expect(getGameState().xp).toBe(before.xp);
  });

  it('does not count a break spent on the screen', () => {
    const clock = open();
    const xp = getGameState().xp;
    startBreak(10);
    stayOnScreen(clock, 10);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));

    expect(screen.getByText(BREAK_COPY.notAway)).toBeInTheDocument();
    expect(getGameState().breaks.at(-1)).toMatchObject({ kept: false, xp: 0 });
    expect(getGameState().xp).toBe(xp);
  });

  it('ends early under ten minutes without recording anything', () => {
    const clock = open();
    const before = getGameState();
    startBreak(30);
    goOutside(clock, 4);

    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.endEarly }));

    expect(screen.getByText(BREAK_COPY.tooShort)).toBeInTheDocument();
    expect(getGameState().activeBreak).toBeNull();
    expect(getGameState().breaks).toHaveLength(before.breaks.length);
    expect(getGameState().xp).toBe(before.xp);
  });

  it('counts ten minutes of a longer break that ended early', () => {
    const clock = open();
    startBreak(45);
    goOutside(clock, 12);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.endEarly }));
    expect(heading()).toBe(BREAK_COPY.returnTitle);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));

    expect(heading()).toBe('10 minutes, kept.');
    expect(getGameState().breaks.at(-1)).toMatchObject({ kept: true, keptMin: 10, xp: 15 });
  });
});

describe('Touch grass: after', () => {
  it('saves the optional note to the journal, tagged Touch Grass', () => {
    const clock = open();
    const notes = getGameState().journal.length;
    startBreak(10);
    goOutside(clock, 10);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));

    fireEvent.change(screen.getByLabelText(BREAK_COPY.noticeLabel), {
      target: { value: 'A heron on the canal, standing very still.' },
    });
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.noticeSave }));

    expect(screen.getByText(BREAK_COPY.noticeSaved)).toBeInTheDocument();
    const journal = getGameState().journal;
    expect(journal).toHaveLength(notes + 1);
    expect(journal.some((note) => note.tag === 'touch-grass' && /heron/.test(note.text))).toBe(
      true,
    );
  });

  it('spaces breaks half an hour apart and pays XP once a day', () => {
    const clock = open();
    startBreak(10);
    goOutside(clock, 10);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.done }));

    const card = within(screen.getByRole('region', { name: BREAK_COPY.slug }));
    expect(card.getByRole('button', { name: BREAK_COPY.start })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(card.getByText('Next break in 30 min')).toBeInTheDocument();
    expect(card.getByText(BREAK_COPY.alreadyRewarded)).toBeInTheDocument();

    act(() => clock.set(at(15, 30)));
    const xp = getGameState().xp;
    startBreak(10);
    goOutside(clock, 10);
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.back }));
    fireEvent.click(screen.getByRole('button', { name: BREAK_COPY.outside }));

    expect(screen.getByText(/10 minutes outside, recorded/)).toBeInTheDocument();
    expect(getGameState().xp).toBe(xp);
  });
});
