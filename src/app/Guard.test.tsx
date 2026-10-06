import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions, getGameState } from '@/game';
import { Guard } from './Guard';
import { PENDING_DESTINATION_KEY } from './guardDecision';

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
let pathname = '/today';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

function plant() {
  const result = gameActions.onboard({
    name: 'Sam',
    treeName: 'Fern',
    species: 'oak',
    region: 'WORLD',
    focus: ['move', 'eat'],
  });
  expect(result.ok).toBe(true);
}

function setLocation(url: string) {
  window.history.replaceState(null, '', url);
}

beforeEach(() => {
  router.replace.mockClear();
  gameActions.resetAll();
  setLocation('/');
});

describe('<Guard>', () => {
  it('redirects a visitor without a tree from an app route to onboarding', async () => {
    pathname = '/quests';
    setLocation('/quests');
    render(
      <Guard>
        <p>Quests page</p>
      </Guard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/start'));
    expect(screen.queryByText('Quests page')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBe('/quests');
  });

  it('keeps a challenge link for after onboarding', async () => {
    pathname = '/community';
    setLocation('/community#c=abc123');
    render(
      <Guard>
        <p>Community page</p>
      </Guard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/start'));
    expect(window.sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBe('/community#c=abc123');
  });

  it('shows onboarding to a visitor without a tree', () => {
    pathname = '/start';
    render(
      <Guard>
        <p>Onboarding page</p>
      </Guard>,
    );
    expect(screen.getByText('Onboarding page')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not pull the user out of onboarding the moment the tree is planted', () => {
    pathname = '/start';
    render(
      <Guard>
        <p>Onboarding page</p>
      </Guard>,
    );
    act(() => plant());
    expect(getGameState().onboarding.completedAt).not.toBeNull();
    // The ceremony's last steps still belong to /start; the page itself navigates on.
    expect(screen.getByText('Onboarding page')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sends a user who arrives on onboarding with a tree to the page they asked for', async () => {
    plant();
    window.sessionStorage.setItem(PENDING_DESTINATION_KEY, '/community#c=abc123');
    pathname = '/start';
    render(
      <Guard>
        <p>Onboarding page</p>
      </Guard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/community#c=abc123'));
    expect(screen.queryByText('Onboarding page')).not.toBeInTheDocument();
  });

  it('sends a user with a tree from the landing page to Today', async () => {
    plant();
    pathname = '/';
    render(
      <Guard>
        <p>Landing page</p>
      </Guard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
  });

  it('lets a user with a tree into the app and forgets the remembered destination', async () => {
    plant();
    window.sessionStorage.setItem(PENDING_DESTINATION_KEY, '/quests');
    pathname = '/today';
    render(
      <Guard>
        <p>Today page</p>
      </Guard>,
    );
    expect(screen.getByText('Today page')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(window.sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull());
  });

  it('goes back to the landing page when the data is reset', async () => {
    plant();
    pathname = '/me';
    render(
      <Guard>
        <p>Profile page</p>
      </Guard>,
    );
    expect(screen.getByText('Profile page')).toBeInTheDocument();
    act(() => {
      gameActions.resetAll();
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(window.sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
  });

  it('leaves public pages alone', () => {
    pathname = '/privacy';
    render(
      <Guard>
        <p>Privacy page</p>
      </Guard>,
    );
    expect(screen.getByText('Privacy page')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
