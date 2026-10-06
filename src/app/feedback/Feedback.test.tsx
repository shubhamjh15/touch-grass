import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions, gameEvents, getGameState } from '@/game';
import { Toaster, dismissToast } from '@/ui';
import { useShellStore } from '../shellStore';
import { resetShell, restoreClock, seedGame } from '../test/harness';
import { Feedback } from './Feedback';

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };

vi.mock('next/navigation', () => ({
  usePathname: () => '/log',
  useRouter: () => router,
}));

function renderFeedback() {
  return render(
    <>
      <button type="button">A page button</button>
      <Feedback />
      <Toaster />
    </>,
  );
}

beforeEach(() => {
  router.push.mockClear();
  seedGame('day12');
  resetShell();
});

afterEach(() => {
  act(() => dismissToast());
  restoreClock();
});

describe('<Feedback>', () => {
  it('answers a log with one toast, and its Undo takes the log back', async () => {
    renderFeedback();
    const before = getGameState().logs.length;

    act(() => {
      const result = gameActions.logAction({ actionId: 'walk-cycle-instead-of-car', qty: 3 });
      expect(result.ok).toBe(true);
    });
    expect(getGameState().logs).toHaveLength(before + 1);

    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);

    fireEvent.click(undo);
    expect(getGameState().logs).toHaveLength(before);
    expect(await screen.findByText('Undone.')).toBeInTheDocument();
  });

  it('shows a new badge as a toast that leads to Me', async () => {
    renderFeedback();
    act(() => {
      gameEvents.emit([
        {
          type: 'badge-unlocked',
          badgeId: 'first-steps',
          name: 'First steps',
          emoji: '👣',
          tier: 1,
          tiers: 3,
          xp: 20,
          secret: false,
          prop: null,
        },
      ]);
    });
    expect(await screen.findByText('New badge: First steps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'See it' }));
    expect(router.push).toHaveBeenCalledWith('/me');
  });

  it('shows the level-up dialog without taking focus or blocking the page', async () => {
    renderFeedback();
    const pageButton = screen.getByRole('button', { name: 'A page button' });
    pageButton.focus();

    act(() => {
      gameEvents.emit([
        { type: 'level-up', level: 6, from: 5, title: 'Grove keeper', first: true },
      ]);
    });

    const dialog = await screen.findByRole('dialog', { name: 'Level 6' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveTextContent('Grove keeper');
    expect(pageButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useShellStore.getState().levelUp).toBeNull();
  });

  it('closes the level-up dialog from its button', async () => {
    renderFeedback();
    act(() => useShellStore.getState().setLevelUp({ level: 3, title: 'Sprout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears everything when the data is reset', async () => {
    renderFeedback();
    act(() => useShellStore.getState().setLevelUp({ level: 3, title: 'Sprout' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    act(() => {
      gameActions.resetAll();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
