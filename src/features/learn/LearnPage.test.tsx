import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACTS, LESSONS, MYTHS } from '@/data/content';
import { XP_MYTH_FLIP, dailyFact, game, gameActions, getGameState } from '@/game';
import { resetSfx } from '@/lib/sfx';
import LearnPage from './LearnPage';
import { QUIZ_DRAFTS_KEY, resetQuizDraftFallback } from './model/quizDrafts';
import { at, seed, xp } from './testHarness';

// A tiny stand-in for the router: `replace` changes the query string and re-renders readers.
const nav = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    read: () => search,
    set(next: string) {
      search = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace: vi.fn(),
  };
});

vi.mock('next/navigation', async () => {
  const React = await import('react');
  const router = {
    replace: (href: string, options?: { scroll?: boolean }) => {
      nav.replace(href, options);
      nav.set(href.split('?')[1] ?? '');
    },
    push: vi.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => '/learn',
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, nav.read, nav.read);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

// The Grove is a WebGL canvas; the page only needs the box it reserves.
vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  emitPulse: vi.fn(),
}));

let now = at(10, 31);

beforeEach(() => {
  now = at(10, 31);
  nav.set('');
  nav.replace.mockClear();
  game.setClock(() => now);
  resetSfx();
  resetQuizDraftFallback();
});

afterEach(() => {
  game.setClock(() => Date.now());
  gameActions.resetAll();
});

const lessonLinks = () =>
  within(screen.getByRole('region', { name: 'Lessons' })).getAllByRole('link');

const mythButtons = () =>
  within(screen.getByRole('list', { name: 'Myth cards' })).getAllByRole('button');

const mythButton = (index: number) => {
  const button = mythButtons()[index];
  if (!button) throw new Error(`no myth card ${index + 1}`);
  return button;
};

describe('the shelf', () => {
  it('lists the ten lessons with their state and score', () => {
    seed('day12');
    render(<LearnPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument();
    const links = lessonLinks();
    expect(links).toHaveLength(LESSONS.length);
    links.forEach((link, index) => {
      const lesson = LESSONS[index];
      expect(link).toHaveAccessibleName(lesson?.title);
      expect(link).toHaveAttribute('href', `/learn/${lesson?.id}`);
    });
    // The fixture passed lesson 1 with two of three; everything else is untouched.
    expect(links[0]).toHaveAccessibleDescription(/Lesson 1\. .*Climate\. Passed, 2 of 3\./);
    expect(links[1]).toHaveAccessibleDescription(/Lesson 2\. .*Climate\. New\./);
    expect(
      within(screen.getByRole('group', { name: 'Your progress in Learn' })).getByText('1'),
    ).toBeInTheDocument();
  });

  it('starts a first run at lesson 1, with everything new', () => {
    seed('day1');
    render(<LearnPage />);

    const featured = screen.getByRole('region', { name: LESSONS[0]?.title });
    expect(within(featured).getByText('Start here')).toBeInTheDocument();
    expect(within(featured).getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/the-blanket',
    );
    for (const link of lessonLinks()) expect(link).toHaveAccessibleDescription(/New\./);
  });

  it('features the lesson recommended for the focus areas once the first is passed', () => {
    seed('day12');
    render(<LearnPage />);

    // Focus is eat + move: the first unpassed lesson that serves either is "Big levers".
    const board = getGameState();
    expect(board.profile.focus).toEqual(['eat', 'move']);
    const featured = screen.getByRole('region', { name: 'Big levers vs. small gestures' });
    expect(within(featured).getByText('Up next for you')).toBeInTheDocument();
    expect(within(featured).getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/big-levers',
    );
  });

  it('brings an unfinished quiz back first and links straight to it', () => {
    seed('day12');
    localStorage.setItem(
      QUIZ_DRAFTS_KEY,
      JSON.stringify({ 'getting-around': { attempt: 0, answers: [1] } }),
    );
    render(<LearnPage />);

    const featured = screen.getByRole('region', { name: 'Getting around' });
    expect(within(featured).getByText('Pick up the quiz')).toBeInTheDocument();
    expect(within(featured).getByText(/1 of 3 answered/)).toBeInTheDocument();
    expect(within(featured).getByRole('link', { name: 'Resume quiz' })).toHaveAttribute(
      'href',
      '/learn/getting-around#quiz',
    );
    const card = lessonLinks().find(
      (link) => link.getAttribute('href') === '/learn/getting-around',
    );
    expect(card).toHaveAccessibleDescription(/Quiz in progress, 1 of 3 answered/);
  });

  it('says the shelf is complete when all ten are passed', () => {
    seed('day12');
    for (const lesson of LESSONS) gameActions.completeLesson(lesson.id, 2);
    render(<LearnPage />);

    expect(screen.getByRole('heading', { name: 'All ten passed.' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start lesson' })).not.toBeInTheDocument();
    for (const link of lessonLinks()) expect(link).toHaveAccessibleDescription(/Passed, \d of 3/);
  });
});

describe('the topic filter', () => {
  it('filters the lessons and keeps the choice in the URL', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<LearnPage />);

    const filter = within(screen.getByRole('group', { name: 'Filter lessons by topic' }));
    expect(filter.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(filter.getByRole('button', { name: /^Eat/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/learn?topic=eat', { scroll: false });
    expect(filter.getByRole('button', { name: /^Eat/ })).toHaveAttribute('aria-pressed', 'true');
    expect(lessonLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/learn/on-your-plate',
      '/learn/food-we-never-eat',
    ]);
    expect(screen.getByText('Showing 2 lessons about Eat.')).toBeInTheDocument();

    // Pressing the selected topic again takes the filter off.
    await user.click(filter.getByRole('button', { name: /^Eat/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/learn', { scroll: false });
    expect(lessonLinks()).toHaveLength(LESSONS.length);
  });

  it('opens already filtered from a deep link and ignores a topic that does not exist', () => {
    seed('day12');
    nav.set('topic=climate');
    const { unmount } = render(<LearnPage />);
    expect(lessonLinks()).toHaveLength(2);
    unmount();

    nav.set('topic=nonsense');
    render(<LearnPage />);
    expect(lessonLinks()).toHaveLength(LESSONS.length);
  });
});

describe('myth busters', () => {
  it('shows ten cards, front side up, with the verdict out of reach', () => {
    seed('day12');
    render(<LearnPage />);

    const buttons = mythButtons();
    expect(buttons).toHaveLength(MYTHS.length);
    for (const button of buttons) expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(mythButton(0)).toHaveAccessibleName('“One person can’t make a difference.”');
    expect(mythButton(0)).toHaveAccessibleDescription('Myth 1. Flip to check.');
    // The back is in the page but turned away: hidden from assistive tech and inert.
    const verdict = screen.getAllByText('Mostly false.', { ignore: 'script' })[0];
    expect(verdict?.closest('[inert]')).not.toBeNull();
    expect(verdict?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('flips on a click, announces the verdict and pays XP for the first flip only', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<LearnPage />);
    const before = xp();

    await user.click(mythButton(0));
    expect(mythButton(0)).toHaveAttribute('aria-pressed', 'true');
    expect(xp()).toBe(before + XP_MYTH_FLIP);
    expect(getGameState().learn.mythsFlipped).toEqual([1]);

    // The verdict is announced, and it is now the button's description.
    const status = screen
      .getAllByRole('status')
      .find((region) => region.textContent?.startsWith('Mostly false.'));
    expect(status).toHaveTextContent(/Mostly false\. Any single source .* Plus 5 XP\./);
    expect(mythButton(0)).toHaveAccessibleDescription(/^Mostly false\. Any single source/);

    // The back is reachable now: its source and its lesson are real links.
    const card = mythButton(0).closest('li');
    if (!card) throw new Error('no card');
    expect(within(card).getByRole('link', { name: /IPCC/ })).toHaveAttribute(
      'href',
      '/methodology#source-ipccAR6wg3',
    );
    expect(within(card).getByRole('link', { name: 'Read the lesson' })).toHaveAttribute(
      'href',
      '/learn/big-levers',
    );

    // Back and over again: the card turns, the XP does not come twice.
    await user.click(mythButton(0));
    expect(mythButton(0)).toHaveAttribute('aria-pressed', 'false');
    await user.click(mythButton(0));
    expect(mythButton(0)).toHaveAttribute('aria-pressed', 'true');
    expect(xp()).toBe(before + XP_MYTH_FLIP);
    expect(getGameState().learn.mythsFlipped).toEqual([1]);
    expect(
      within(screen.getByRole('group', { name: 'Your progress in Learn' })).getByText(
        'Myths checked',
      ),
    ).toBeInTheDocument();
  });

  it('flips with Enter and with Space, from the keyboard alone', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<LearnPage />);

    mythButton(1).focus();
    await user.keyboard('{Enter}');
    expect(mythButton(1)).toHaveAttribute('aria-pressed', 'true');
    expect(mythButton(1)).toHaveFocus();

    await user.keyboard(' ');
    expect(mythButton(1)).toHaveAttribute('aria-pressed', 'false');
    expect(mythButton(1)).toHaveFocus();

    // Tab leaves a face-down card for the next card, never for a link on its hidden back.
    await user.tab();
    expect(mythButton(2)).toHaveFocus();
    expect(getGameState().learn.mythsFlipped).toEqual([2]);
  });

  it('remembers which myths were checked on the next visit', async () => {
    const user = userEvent.setup();
    seed('day12');
    const { unmount } = render(<LearnPage />);
    await user.click(mythButton(4));
    unmount();

    render(<LearnPage />);
    const card = mythButton(4).closest('li');
    if (!card) throw new Error('no card');
    // Face down again, but marked as checked instead of offering XP.
    expect(mythButton(4)).toHaveAttribute('aria-pressed', 'false');
    expect(within(card).getByText('Checked')).toBeInTheDocument();
    expect(within(card).queryByText('+5 XP')).not.toBeInTheDocument();
  });

  it('turns back on a plain click on the paper, but not while text is selected', async () => {
    const user = userEvent.setup();
    seed('day12');
    render(<LearnPage />);
    await user.click(mythButton(0));

    const card = mythButton(0).closest('li');
    if (!card) throw new Error('no card');
    const paper = within(card).getByText(/Any single source is small/);
    const selection = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => 'single source' } as Selection);
    await user.click(paper);
    expect(mythButton(0)).toHaveAttribute('aria-pressed', 'true');

    selection.mockReturnValue({ toString: () => '' } as Selection);
    await user.click(paper);
    expect(mythButton(0)).toHaveAttribute('aria-pressed', 'false');
  });
});

describe("today's fact", () => {
  it('prints the fact of the day once the user has shown up', () => {
    seed('day12');
    render(<LearnPage />);

    const state = getGameState();
    const ref = dailyFact(state.clock.today, state.profile.userSeed);
    const fact = FACTS[ref.number - 1];
    if (!fact) throw new Error('no fact');
    const note = screen.getByRole('complementary', { name: /Today's fact/ });
    expect(note).toHaveTextContent(fact.sourceLabel);
    expect(within(note).getByRole('link', { name: fact.sourceLabel })).toHaveAttribute(
      'href',
      `/methodology#source-${fact.source}`,
    );
    const more = within(note).getByRole('link', { name: /Tell me more|Take a break outside/ });
    expect(more).toHaveAttribute(
      'href',
      fact.link.kind === 'lesson' ? `/learn/${fact.link.lessonId}` : '/today?break=1',
    );
  });

  it('keeps the slot, and says how to fill it, before the tree is watered', () => {
    seed('thirsty');
    render(<LearnPage />);

    const note = screen.getByRole('complementary', { name: /Today's fact/ });
    expect(note).toHaveTextContent("Today's fact prints once Fern is watered.");
    expect(within(note).getByRole('link', { name: 'Water Fern' })).toHaveAttribute(
      'href',
      '/today',
    );
  });
});
