import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoachStore } from '@/ai';
import '@/app/bridge/coachSandbox';
import {
  SANDBOX_MARK_KEY,
  SANDBOX_PREFIX,
  STORAGE_KEYS,
  game,
  gameActions,
  getGameState,
  selectTreeStatus,
} from '@/game';
import { dayKey } from '@/lib/dates';
import { COPY, TOUR_COPY } from './copy';
import { cancelDemoStart, exitDemo, isDemoOn, leaveLink, startDemo } from './demo';
import DemoChrome from './DemoChrome';
import { DEMO_TOUR_KEY, resetDemoStore, tourSend, useDemoStore } from './demoStore';
import { DEMO_DAYS, DEMO_TREE_NAME } from './model/demoWorld';
import { DEMO_CACHE_KEY, forgetDemoWorld } from './model/grow';

// Growing the world plays two hundred days through the engine: seconds, on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const nav = vi.hoisted(() => ({ path: '/today', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.path,
}));

/** Everything in the device's storage, as text: what "untouched" is measured against. */
const device = (): Record<string, string | null> =>
  Object.fromEntries(
    Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
  );

function plantOwnTree(): void {
  gameActions.onboard({ name: 'Maya', treeName: 'Juniper', species: 'pine' });
  gameActions.logAction({ actionId: 'plant-based-meal', qty: 2 });
}

/** What the tab holds for the demo, leaving out the grown world it keeps for the day. */
const tab = (): string[] =>
  Object.keys(sessionStorage)
    .filter((key) => key !== DEMO_CACHE_KEY)
    .sort();

const question = (text: string) =>
  useCoachStore.getState().append({
    id: `m-${text}`,
    role: 'user',
    content: text,
    createdAt: Date.now(),
    status: 'complete',
  });

beforeEach(() => {
  nav.path = '/today';
  nav.replace.mockReset();
  game.rehydrate();
});

afterEach(() => {
  // The storage itself is emptied by the shared setup; the game must forget its sandbox too.
  game.leaveSandbox();
  useCoachStore.getState().clear();
  resetDemoStore();
  localStorage.clear();
  game.rehydrate();
});

describe('startDemo', () => {
  it('shows a grown world that ends today, in a sandbox, and begins the tour', async () => {
    expect(isDemoOn()).toBe(false);
    expect(await startDemo()).toBe(true);

    expect(isDemoOn()).toBe(true);
    const state = getGameState();
    expect(state.profile.treeName).toBe(DEMO_TREE_NAME);
    expect(state.clock.today).toBe(dayKey(Date.now()));
    expect(selectTreeStatus(state, Date.now()).stageLabel).toMatch(/Mature tree/);
    expect(useDemoStore.getState()).toMatchObject({
      phase: 'idle',
      day: DEMO_DAYS,
      tour: { status: 'running', step: 'world' },
    });
  });

  it('keeps everything it stores in the tab: nothing reaches the device', async () => {
    const before = device();
    await startDemo();
    gameActions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    question('What next?');

    expect(device()).toEqual(before);
    expect(tab()).toEqual(
      [
        `${SANDBOX_PREFIX}${STORAGE_KEYS.coach}`,
        `${SANDBOX_PREFIX}${STORAGE_KEYS.game}`,
        DEMO_TOUR_KEY,
        SANDBOX_MARK_KEY,
      ].sort(),
    );
  });

  it('leaves a visitor without a tree exactly as they were', async () => {
    const before = device();
    await startDemo();
    gameActions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    expect(exitDemo()).toEqual({ hasOwnTree: false });

    expect(isDemoOn()).toBe(false);
    expect(getGameState().onboarding.completedAt).toBeNull();
    expect(getGameState().logs).toEqual([]);
    expect(device()).toEqual(before);
    expect(tab()).toEqual([]);
  });

  it('never touches a real save, and brings it back untouched', async () => {
    plantOwnTree();
    question('How is Juniper doing?');
    const before = device();
    const mine = getGameState();
    const chat = useCoachStore.getState().messages;
    expect(Object.keys(before).sort()).toEqual([STORAGE_KEYS.coach, STORAGE_KEYS.game].sort());

    await startDemo();
    // The demo has its own tree, its own log and an empty conversation.
    expect(getGameState().profile.treeName).toBe(DEMO_TREE_NAME);
    expect(useCoachStore.getState().messages).toEqual([]);
    gameActions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    gameActions.updateProfile({ treeName: 'Scribbled on' });
    question('What should the demo tree do?');
    expect(device()).toEqual(before);

    expect(exitDemo()).toEqual({ hasOwnTree: true });
    expect(getGameState()).toEqual(mine);
    expect(useCoachStore.getState().messages).toEqual(chat);
    expect(device()).toEqual(before);
    expect(tab()).toEqual([]);
  });

  it('starts from a fresh copy of the world every time, without growing it again', async () => {
    await startDemo();
    const first = getGameState();
    gameActions.updateProfile({ treeName: 'Scribbled on' });
    exitDemo();
    await startDemo();
    expect(getGameState()).toEqual(first);
  });

  it('is one start however often it is asked for', async () => {
    const [a, b] = await Promise.all([startDemo(), startDemo()]);
    expect([a, b]).toEqual([true, true]);
    expect(await startDemo()).toBe(true);
    expect(isDemoOn()).toBe(true);
  });

  it('does not switch on under someone who left while the world was growing', async () => {
    forgetDemoWorld();
    const before = device();
    const asked = startDemo();
    cancelDemoStart();
    expect(await asked).toBe(false);
    expect(isDemoOn()).toBe(false);
    expect(getGameState().onboarding.completedAt).toBeNull();
    expect(device()).toEqual(before);
    expect(useDemoStore.getState().tour).toEqual({ status: 'idle' });

    // The world it grew is kept: asking again shows it at once.
    expect(await startDemo()).toBe(true);
    expect(isDemoOn()).toBe(true);
  });

  it('remembers a skipped tour for the session, and forgets an unfinished one', async () => {
    await startDemo();
    tourSend({ type: 'next' });
    exitDemo();
    await startDemo();
    expect(useDemoStore.getState().tour).toMatchObject({ status: 'running', step: 'world' });

    tourSend({ type: 'dismiss' });
    exitDemo();
    await startDemo();
    expect(useDemoStore.getState().tour).toEqual({ status: 'closed', finished: false });
  });
});

describe('the demo chrome', () => {
  it('says on every page that this is a demo and nothing is saved, with the ways out', async () => {
    await startDemo();
    render(<DemoChrome />);
    const banner = screen.getByRole('complementary', { name: COPY.banner.region });
    expect(within(banner).getByText(COPY.banner.label)).toBeInTheDocument();
    expect(within(banner).getByText(COPY.banner.note)).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: COPY.banner.own })).toHaveAttribute(
      'href',
      leaveLink('start'),
    );
    expect(within(banner).getByRole('link', { name: COPY.banner.exitLabel })).toHaveAttribute(
      'href',
      leaveLink('home'),
    );
  });

  it('walks the four steps with Next, announces each and ends on the way to a tree of your own', async () => {
    const user = userEvent.setup();
    await startDemo();
    render(<DemoChrome />);

    const card = () => screen.getByRole('dialog');
    expect(card()).toHaveAttribute('aria-modal', 'false');
    expect(within(card()).getByRole('heading', { name: /This world is alive/ })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(/Tour, step 1 of 4/);

    await user.click(within(card()).getByRole('button', { name: COPY.tour.next }));
    expect(within(card()).getByRole('heading', { name: /Log one real thing/ })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(/Tour, step 2 of 4/);

    await user.click(within(card()).getByRole('button', { name: COPY.tour.next }));
    await user.click(within(card()).getByRole('button', { name: COPY.tour.next }));
    expect(within(card()).getByRole('heading', { name: /Ask in your own words/ })).toBeVisible();

    await user.click(within(card()).getByRole('button', { name: COPY.tour.next }));
    expect(within(card()).getByRole('heading', { name: COPY.tour.wrapTitle })).toBeVisible();
    expect(within(card()).getByRole('link', { name: COPY.banner.own })).toHaveAttribute(
      'href',
      leaveLink('start'),
    );
    await user.click(within(card()).getByRole('button', { name: COPY.tour.wrapStay }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useDemoStore.getState().tour).toEqual({ status: 'closed', finished: true });
  });

  it('moves on when the visitor really does the thing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await startDemo();
      tourSend({ type: 'next' });
      render(<DemoChrome />);
      expect(screen.getByRole('heading', { name: /Log one real thing/ })).toBeVisible();

      act(() => {
        gameActions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
      });
      expect(useDemoStore.getState().tour).toEqual({ status: 'running', step: 'log', did: true });
      expect(screen.getByRole('dialog')).toHaveTextContent(TOUR_COPY.log.here.done ?? '');

      // It lingers so the tree can be watched, then points at Impact.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(useDemoStore.getState().tour).toMatchObject({ status: 'running', step: 'impact' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts a question to the coach as the fourth step', async () => {
    await startDemo();
    tourSend({ type: 'next' });
    tourSend({ type: 'next' });
    tourSend({ type: 'next' });
    render(<DemoChrome />);
    expect(useDemoStore.getState().tour).toMatchObject({ step: 'coach', did: false });
    act(() => question('What is my biggest lever?'));
    expect(useDemoStore.getState().tour).toMatchObject({ step: 'coach', did: true });
  });

  it('closes on Escape, stays closed, and starts again from the banner', async () => {
    const user = userEvent.setup();
    await startDemo();
    render(<DemoChrome />);
    const tourButton = screen.getByRole('button', { name: COPY.banner.tourResume });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useDemoStore.getState().tour).toEqual({ status: 'closed', finished: false });
    expect(JSON.parse(sessionStorage.getItem(DEMO_TOUR_KEY) ?? 'null')).toEqual({
      status: 'closed',
      finished: false,
    });

    expect(tourButton).toHaveAccessibleName(COPY.banner.tourRestart);
    await user.click(tourButton);
    const card = screen.getByRole('dialog');
    expect(within(card).getByRole('heading', { name: /This world is alive/ })).toBeVisible();
    expect(card).toHaveFocus();

    // From inside the card, Escape hands focus back to the button that brings it back.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tourButton).toHaveFocus();
  });

  it('says where to go when a step belongs to another page', async () => {
    await startDemo();
    nav.path = '/quests';
    render(<DemoChrome />);
    expect(screen.getByRole('heading', { name: /Start in the world/ })).toBeVisible();
    act(() => tourSend({ type: 'next' }));
    act(() => tourSend({ type: 'next' }));
    expect(screen.getByRole('heading', { name: /See the honest numbers/ })).toBeVisible();
  });
});
