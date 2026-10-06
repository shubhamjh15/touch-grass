import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_DESTINATION_KEY } from '@/app/guardDecision';
import { BASELINE_QUESTIONS, BASELINE_WORKED_EXAMPLES } from '@/data/catalogue';
import {
  XP_CEREMONY,
  XP_CHECK_IN,
  encodeChallenge,
  gameActions,
  gameEvents,
  getGameState,
  isOnboarded,
  type GameEvent,
} from '@/game';
import { DRAFT_KEY, loadDraft } from './draft';
import { QUIZ_QUESTION_IDS } from './flow';
import OnboardingPage from './OnboardingPage';

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  usePathname: () => '/start',
  useRouter: () => router,
}));

// Whole journeys through the flow: many real interactions each, on a machine that may be busy.
vi.setConfig({ testTimeout: 30_000 });

let events: GameEvent[] = [];
let stopListening = () => {};

beforeEach(() => {
  router.replace.mockClear();
  gameActions.resetAll();
  window.history.replaceState(null, '', '/start');
  events = [];
  stopListening = gameEvents.onBatch((batch) => {
    events.push(...batch);
  });
});

afterEach(() => {
  stopListening();
  vi.restoreAllMocks();
});

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const press = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Name, then tree: leaves the page on the tree step. */
async function toTree(name?: string) {
  await heading('What should we call you?');
  if (name) await userEvent.type(screen.getByLabelText('Your name'), name);
  await press('Continue');
  await heading('Pick your tree');
}

/** From the tree step, skipping the quiz, to the planting screen. */
async function skipToPlant(tree: string | RegExp = /^Ready to plant/) {
  await press('Continue');
  await heading('Want a starting line?');
  await press('Skip for now');
  await heading(tree);
}

async function nameTree(name: string) {
  const field = screen.getByLabelText(/Name it/);
  await userEvent.clear(field);
  await userEvent.type(field, name);
}

const planted = () => events.filter((event) => event.type === 'planted');
const ceremonyXp = () =>
  events
    .filter((event) => event.type === 'xp-gained' && event.reason === 'ceremony')
    .reduce((sum, event) => sum + (event.type === 'xp-gained' ? event.amount : 0), 0);

describe('first run without the quiz', () => {
  it('plants a named tree exactly once and opens Today by itself', async () => {
    render(<OnboardingPage />);
    await toTree('Sam');
    await userEvent.click(screen.getByRole('radio', { name: /Cherry/ }));
    await nameTree('Fern');
    await skipToPlant('Ready to plant Fern?');

    expect(isOnboarded(getGameState())).toBe(false);
    await userEvent.dblClick(screen.getByRole('button', { name: 'Plant Fern' }));

    const state = getGameState();
    expect(isOnboarded(state)).toBe(true);
    expect(state.profile).toMatchObject({
      name: 'Sam',
      treeName: 'Fern',
      species: 'cherry',
      region: 'WORLD',
      focus: ['eat', 'move'],
    });
    expect(state.tree.rings).toBe(1);
    expect(state.baseline.current).toBeNull();
    expect(planted()).toHaveLength(1);
    expect(ceremonyXp()).toBe(XP_CEREMONY);
    // The planting pays 25, the first ring pays its usual check-in on top.
    expect(state.xp).toBe(XP_CEREMONY + XP_CHECK_IN);
    // The draft has done its job.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    await heading('Fern is planted.');
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'), { timeout: 5000 });
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('lets someone who would rather not wait carry on', async () => {
    render(<OnboardingPage />);
    await toTree();
    await skipToPlant();
    await press(/^Plant /);
    await heading(/is planted\.$/);
    // The second half of a double click must not skip the moment that has just begun.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(router.replace).not.toHaveBeenCalled();
    await wait(800);
    await press('Continue');
    expect(router.replace).toHaveBeenCalledWith('/today');
    await wait(50);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('will not leave the tree step without a name, and the suggester fills one in', async () => {
    render(<OnboardingPage />);
    await toTree();
    const field = screen.getByLabelText(/Name it/);
    expect((field as HTMLInputElement).value).not.toBe('');

    await userEvent.clear(field);
    await press('Continue');
    expect(await screen.findByRole('alert')).toHaveTextContent('Give your tree a name.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick your tree');

    await press('Suggest a name');
    expect((field as HTMLInputElement).value).not.toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await press('Continue');
    await heading('Want a starting line?');
  });

  it('moves on with Enter from a text field', async () => {
    render(<OnboardingPage />);
    await heading('What should we call you?');
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada{Enter}');
    await heading('Pick your tree');
  });

  it('shows one thin progress bar that only fills up', async () => {
    render(<OnboardingPage />);
    await heading('What should we call you?');
    const before = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    await press('Continue');
    await heading('Pick your tree');
    const after = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(after).toBeGreaterThan(before);
  });
});

describe('progress', () => {
  it('resumes on the same step with everything typed after a reload', async () => {
    const first = render(<OnboardingPage />);
    await toTree('Sam');
    await userEvent.click(screen.getByRole('radio', { name: /Pine/ }));
    await nameTree('Twiglet');
    expect(getGameState().onboarding.step).toBe(3);
    first.unmount();
    window.history.replaceState(null, '', '/start');

    render(<OnboardingPage />);
    await heading('Pick your tree');
    expect(screen.getByLabelText(/Name it/)).toHaveValue('Twiglet');
    expect(screen.getByRole('radio', { name: /Pine/ })).toBeChecked();
    expect(loadDraft()?.name).toBe('Sam');
  });

  it("walks back with the page's Back button and with the browser's", async () => {
    render(<OnboardingPage />);
    await heading('What should we call you?');
    // On the first screen Back leaves for the landing page.
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/');
    await toTree();

    await press('Back');
    await heading('What should we call you?');
    act(() => window.history.forward());
    await heading('Pick your tree');
    act(() => window.history.back());
    await heading('What should we call you?');
  });

  it('says so when nothing can be saved, and carries on in memory', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    render(<OnboardingPage />);
    await toTree();
    expect(screen.getByText("Private window: progress won't be saved.")).toBeInTheDocument();
    await skipToPlant();
    await press(/^Plant /);
    expect(isOnboarded(getGameState())).toBe(true);
  });

  it('takes Back away once the tree is planted', async () => {
    render(<OnboardingPage />);
    await toTree();
    await skipToPlant();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    await press(/^Plant /);
    await heading(/is planted\.$/);
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

function wantedIndex(question: string, optionId: string): number {
  const options = BASELINE_QUESTIONS.find((entry) => entry.id === question)?.options ?? [];
  return Math.max(
    0,
    options.findIndex((option) => option.id === optionId),
  );
}

describe('the starting-line quiz', () => {
  const example = BASELINE_WORKED_EXAMPLES.find((entry) => entry.region === 'GB');

  async function answerAll() {
    for (const question of QUIZ_QUESTION_IDS) {
      const group = await screen.findByRole('group');
      const options = within(group).getAllByRole('button');
      const wanted = example?.answers[question] ?? '';
      await userEvent.click(options[wantedIndex(question, wanted)] as HTMLElement);
      // The quiz moves on by itself.
      await waitFor(() => expect(group).not.toBeInTheDocument());
    }
  }

  it('offers the quiz on its first screen, with a skip', async () => {
    render(<OnboardingPage />);
    await toTree();
    await press('Continue');
    await heading('Want a starting line?');
    expect(screen.getByRole('button', { name: 'Take the quiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
  });

  it('asks the questions one at a time and shows an honest result', async () => {
    render(<OnboardingPage />);
    await toTree();
    await nameTree('Fern');
    await press('Continue');
    await press('Take the quiz');

    await heading('How do you eat?');
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
    await answerAll();

    await heading('Your starting line');
    expect(document.body).toHaveTextContent(/approximately 8\s*tonnes/);
    expect(screen.getByText(/give or take 40%/)).toBeInTheDocument();
    expect(screen.getByText(/left out/)).toBeInTheDocument();

    await press('Continue');
    await heading('Ready to plant Fern?');
    await press('Plant Fern');

    const state = getGameState();
    expect(state.profile.focus).toEqual(['eat', 'move']);
    // Home is the world-average grid until the user sets a region in Me.
    expect(state.baseline.current?.tonnes.total).toBeCloseTo(8.03, 1);
    expect(planted()).toHaveLength(1);
  });

  it('keeps the answers given when it is skipped part-way', async () => {
    render(<OnboardingPage />);
    await toTree();
    await press('Continue');
    await press('Take the quiz');
    const group = await screen.findByRole('group');
    await userEvent.click(within(group).getByRole('button', { name: /^Vegan/ }));
    await waitFor(() => expect(group).not.toBeInTheDocument());

    await press('Skip for now');
    await heading(/^Ready to plant/);
    expect(loadDraft()?.answers).toEqual({ diet: 'vegan' });
    expect(loadDraft()?.quiz).toBe('skipped');

    await press(/^Plant /);
    expect(getGameState().baseline.current).toBeNull();
  });

  it('asks nothing about sound, motion or 3D', async () => {
    render(<OnboardingPage />);
    await toTree();
    await skipToPlant();
    expect(screen.queryByText(/sound|motion|3D/i)).not.toBeInTheDocument();
  });
});

describe('arriving with baggage', () => {
  const realLog = (daysAgo: number, type: string) => ({
    id: String(Date.now() - daysAgo * 86_400_000),
    type,
  });

  function seedLegacy() {
    localStorage.setItem(
      'actionLogs',
      JSON.stringify([realLog(3, 'Veggie Meal'), realLog(2, 'Cold Wash'), { id: '1', type: 'x' }]),
    );
    gameActions.scanLegacy();
  }

  it('offers real logs from the old app first, and brings them along when asked', async () => {
    seedLegacy();
    render(<OnboardingPage />);
    await heading('Bring your old logs along?');
    expect(screen.getByText(/We found 2 actions/)).toBeInTheDocument();

    await press('Bring them');
    await toTree();
    await skipToPlant();
    await press(/^Plant /);

    const state = getGameState();
    expect(state.onboarding.legacy).toBe('imported');
    expect(state.logs.filter((log) => log.source === 'legacy')).toHaveLength(2);
    expect(planted()).toHaveLength(1);
  });

  it('leaves the old logs behind on "Start fresh", but only once the tree is planted', async () => {
    seedLegacy();
    render(<OnboardingPage />);
    await heading('Bring your old logs along?');
    await press('Start fresh');
    await heading('What should we call you?');
    // Still undecided as far as the game is concerned: Back can change the answer.
    expect(getGameState().onboarding.legacy).toBe('offered');

    await toTree();
    await skipToPlant();
    await press(/^Plant /);
    const state = getGameState();
    expect(state.onboarding.legacy).toBe('declined');
    expect(state.logs).toHaveLength(0);
    expect(state.tree.rings).toBe(1);
  });

  it('keeps a challenge link and opens it after planting', async () => {
    const link = `/community#c=${encodeChallenge({
      v: 1,
      k: 'rings_5',
      s: '2026-10-05',
      d: 7,
      t: 'Juniper',
    })}`;
    sessionStorage.setItem(PENDING_DESTINATION_KEY, link);

    render(<OnboardingPage />);
    await heading('What should we call you?');
    expect(screen.getByText(/challenge opens once your tree is planted/)).toBeInTheDocument();

    await toTree();
    await nameTree('Fern');
    await skipToPlant();
    await press('Plant Fern');
    await heading('Fern is planted.');
    expect(screen.getByText('Taking you to your challenge.')).toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(link), { timeout: 5000 });
    expect(sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
  });
});
