import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_DESTINATION_KEY } from '@/app/guardDecision';
import { BASELINE_WORKED_EXAMPLES } from '@/data/catalogue';
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

// Whole journeys through real timers: slow on a shared machine, never flaky in logic.
vi.setConfig({ testTimeout: 30_000 });

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  usePathname: () => '/start',
  useRouter: () => router,
}));

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
  vi.useRealTimers();
});

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const press = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

/** Promise → You → Tree, leaving the page on the tree step. */
async function toTree(name?: string) {
  await press("Let's plant");
  await heading('What should we call you?');
  if (name) await userEvent.type(screen.getByLabelText('Your name'), name);
  await press('Next');
  await heading('Pick a tree');
}

/** From the tree step, skipping the quiz, to the ceremony. */
async function skipToCeremony() {
  await press('Next');
  await heading('Know where you start?');
  await press(/Skip for now/);
  await heading('Pick up to three.');
  await press('Next');
  await heading('Set it up your way');
  await press('Go plant');
  await heading(/Press and hold to plant/);
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
  it('plants a named tree exactly once and hands over to Today', async () => {
    render(<OnboardingPage />);
    await heading("Let's plant.");
    await toTree('Sam');
    await userEvent.click(screen.getByRole('radio', { name: /Cherry blossom/ }));
    await nameTree('Fern');
    await skipToCeremony();

    expect(isOnboarded(getGameState())).toBe(false);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Press and hold to plant Fern.',
    );

    const plant = screen.getByRole('button', { name: 'Plant' });
    await userEvent.dblClick(plant);

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
    // The ceremony's own XP, plus the check-in that drawing ring 1 counts as.
    expect(state.xp).toBe(XP_CEREMONY + XP_CHECK_IN);
    // The draft has done its job.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    await heading('Fern is planted.');
    expect(screen.getByText('Ring 1 is yours.')).toBeInTheDocument();
    expect(screen.getByText(`+${XP_CEREMONY} XP · Ring 1`)).toBeInTheDocument();

    const onward = await screen.findByRole('button', { name: 'Give Fern its first leaf' });
    await waitFor(() => expect(onward).toBeVisible());
    await userEvent.click(onward);
    expect(router.replace).toHaveBeenCalledWith('/today');
  });

  it('will not leave the tree step without a name, and the suggester fills one in', async () => {
    render(<OnboardingPage />);
    await toTree();
    const field = screen.getByLabelText(/Name it/);
    expect((field as HTMLInputElement).value).not.toBe('');

    await userEvent.clear(field);
    await press('Next');
    expect(await screen.findByRole('alert')).toHaveTextContent('Give your tree a name.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick a tree');

    await press('Suggest a name');
    expect((field as HTMLInputElement).value).not.toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await press('Next');
    await heading('Know where you start?');
  });

  it('moves on with Enter from a text field', async () => {
    render(<OnboardingPage />);
    await press("Let's plant");
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada{Enter}');
    await heading('Pick a tree');
  });

  it('caps the focus areas at three and says so', async () => {
    render(<OnboardingPage />);
    await toTree();
    await press('Next');
    await press(/Skip for now/);
    await heading('Pick up to three.');
    expect(screen.getByRole('button', { name: 'Eat' })).toHaveAttribute('aria-pressed', 'true');
    await press('Power');
    await press('Water');
    expect(screen.getByRole('status')).toHaveTextContent('Three is the limit. Peel one off first.');
    expect(screen.getByRole('button', { name: 'Water' })).not.toHaveAttribute('aria-pressed');
    expect(screen.getByText('3 of 3 picked')).toBeInTheDocument();
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
    await heading('Pick a tree');
    expect(screen.getByLabelText(/Name it/)).toHaveValue('Twiglet');
    expect(screen.getByRole('radio', { name: /Pine/ })).toBeChecked();
    expect(loadDraft()?.name).toBe('Sam');
  });

  it("walks back with the page's Back button and with the browser's", async () => {
    render(<OnboardingPage />);
    await heading("Let's plant.");
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    await toTree();

    await press('Back');
    await heading('What should we call you?');
    act(() => window.history.back());
    await heading("Let's plant.");
    act(() => window.history.forward());
    await heading('What should we call you?');
  });

  it('says so when nothing can be saved, and carries on in memory', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    render(<OnboardingPage />);
    await toTree();
    expect(screen.getByText("Private window: progress won't be saved.")).toBeInTheDocument();
    await skipToCeremony();
    await press('Plant');
    expect(isOnboarded(getGameState())).toBe(true);
  });
});

describe('the starting-line quiz', () => {
  const example = BASELINE_WORKED_EXAMPLES.find((entry) => entry.region === 'GB');

  async function answerAll() {
    for (const question of QUIZ_QUESTION_IDS) {
      const group = await screen.findByRole('group', { name: /\?$/ });
      const options = within(group).getAllByRole('button');
      const wanted = example?.answers[question] ?? '';
      const index = wantedIndex(question, wanted);
      await userEvent.click(options[index] as HTMLElement);
      // The quiz moves on by itself.
      await waitFor(() => expect(group).not.toBeInTheDocument());
    }
  }

  it('asks where home is, then six questions, and shows an honest result', async () => {
    render(<OnboardingPage />);
    await toTree();
    await nameTree('Fern');
    await press('Next');
    await press(/Take the 60-second quiz/);

    await heading("Where's home?");
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /United Kingdom/ }));
    await press('Next');
    await answerAll();

    await heading('Your starting line');
    expect(screen.getByText('7.8')).toBeInTheDocument();
    expect(screen.getByText(/give or take 40%/)).toBeInTheDocument();
    expect(screen.getByText(/It leaves out public services/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 °C-compatible lifestyle by 2030/)).toBeInTheDocument();
    expect(
      screen.getByText(/Average lifestyle footprint in United Kingdom, 2019/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About this estimate' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How this is calculated' })).toHaveAttribute(
      'href',
      '/methodology#baseline',
    );

    // Adopting the suggestion skips the focus step.
    await press('Use these as my focus');
    await heading('Set it up your way');
    await press('Go plant');
    await press('Plant');

    const state = getGameState();
    expect(state.profile.region).toBe('GB');
    expect(state.profile.focus).toEqual(['eat', 'move']);
    expect(state.baseline.current?.tonnes.total).toBeCloseTo(example?.result.total ?? 0, 1);
    expect(planted()).toHaveLength(1);
  });

  it('keeps the answers when it is left midway, and plants without a starting line', async () => {
    render(<OnboardingPage />);
    await toTree();
    await press('Next');
    await press(/Take the 60-second quiz/);
    await heading("Where's home?");
    await press('Next');
    const group = await screen.findByRole('group', { name: /how you eat/ });
    await userEvent.click(within(group).getByRole('button', { name: /^Vegan/ }));
    await waitFor(() => expect(group).not.toBeInTheDocument());

    await press('Finish later');
    await heading('Pick up to three.');
    expect(loadDraft()?.answers).toEqual({ diet: 'vegan' });
    expect(loadDraft()?.quiz).toBe('paused');

    await press('Back');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Pick up to three.'),
    );
  });
});

function wantedIndex(question: string, optionId: string): number {
  const ids: Record<string, string[]> = {
    diet: ['vegan', 'vegetarian', 'pescatarian', 'low-meat', 'medium-meat', 'high-meat'],
    transportMode: [
      'walk-cycle',
      'ebike',
      'metro-tram',
      'train',
      'bus',
      'motorbike',
      'car-shared',
      'car-electric',
      'car-alone',
    ],
    weeklyDistance: ['under-25', '25-75', '75-150', '150-300', '300-500', 'over-500'],
    flights: ['none', 'short-1-2', 'short-3-5-or-long-1', 'long-2', 'long-3-plus'],
    homeEnergy: ['minimal', 'electric-typical', 'gas-typical', 'gas-high', 'very-high'],
    shopping: ['minimal', 'modest', 'regular', 'frequent'],
  };
  return Math.max(0, ids[question]?.indexOf(optionId) ?? 0);
}

describe('the ceremony', () => {
  // jsdom has no PointerEvent, so a pointer press would arrive without its button.
  beforeAll(() => {
    if (typeof PointerEvent !== 'undefined') return;
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      },
    );
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  async function toCeremony() {
    render(<OnboardingPage />);
    await toTree();
    await nameTree('Fern');
    await skipToCeremony();
    return screen.getByRole('button', { name: 'Press and hold to plant Fern.' });
  }

  it('plants after a full hold on the keyboard', async () => {
    const hold = await toCeremony();
    vi.useFakeTimers();
    hold.focus();
    fireEvent.keyDown(hold, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(isOnboarded(getGameState())).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(isOnboarded(getGameState())).toBe(true);
    expect(planted()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Give Fern its first leaf' })).toBeVisible();
  });

  it('unwinds when the hold is let go early', async () => {
    const hold = await toCeremony();
    vi.useFakeTimers();
    fireEvent.keyDown(hold, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    fireEvent.keyUp(hold, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(isOnboarded(getGameState())).toBe(false);
    expect(planted()).toHaveLength(0);
  });

  it('plants after a full press and hold with a pointer', async () => {
    const hold = await toCeremony();
    hold.setPointerCapture = vi.fn();
    vi.useFakeTimers();
    fireEvent.pointerDown(hold, { button: 0, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(isOnboarded(getGameState())).toBe(true);
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
    expect(screen.getByText(/were placeholders/)).toBeInTheDocument();

    await press('Bring them');
    await heading("Let's plant.");
    await toTree();
    await skipToCeremony();
    await press('Plant');

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
    await heading("Let's plant.");
    // Still undecided as far as the game is concerned: Back can change the answer.
    expect(getGameState().onboarding.legacy).toBe('offered');

    await toTree();
    await skipToCeremony();
    await press('Plant');
    const state = getGameState();
    expect(state.onboarding.legacy).toBe('declined');
    expect(state.logs).toHaveLength(0);
    expect(state.tree.rings).toBe(1);
  });

  it('keeps a challenge link and opens it after planting', async () => {
    const link = `/community#c=${encodeChallenge({
      v: 1,
      k: 'three-day-ring',
      s: '2026-10-05',
      d: 7,
      t: 'Juniper',
    })}`;
    sessionStorage.setItem(PENDING_DESTINATION_KEY, link);

    render(<OnboardingPage />);
    await heading("Let's plant.");
    expect(screen.getByText(/challenge is waiting/)).toBeInTheDocument();

    await toTree();
    await nameTree('Fern');
    await skipToCeremony();
    await press('Plant');
    const onward = await screen.findByRole('button', { name: 'Carry on' });
    await waitFor(() => expect(onward).toBeVisible());
    await userEvent.click(onward);
    expect(router.replace).toHaveBeenCalledWith(link);
    expect(sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
  });
});
