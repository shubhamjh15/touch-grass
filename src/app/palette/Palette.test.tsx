import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logLink, ROUTES } from '../routes';
import { useShellStore } from '../shellStore';
import { resetShell, restoreClock, seedGame, setViewport } from '../test/harness';
import { Palette } from './Palette';

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };

vi.mock('next/navigation', () => ({
  usePathname: () => '/today',
  useRouter: () => router,
}));

// `next/dynamic` needs the framework's runtime; a plain lazy component loads the same chunk.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType }>) => {
    const Loaded = lazy(loader);
    return function Dynamic() {
      return (
        <Suspense fallback={null}>
          <Loaded />
        </Suspense>
      );
    };
  },
}));

const PLACEHOLDER = 'Search actions and pages';
// The first open fetches the palette's chunk (cmdk and the catalogue).
const SLOW = { timeout: 8000 };
const FIRST_LOAD_MS = 15_000;

// cmdk keeps the selected row in view; jsdom has no layout to scroll.
Element.prototype.scrollIntoView = vi.fn();

const press = (init: KeyboardEventInit, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, init);
  });

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  seedGame('day12');
  resetShell();
  setViewport('desktop');
});

afterEach(() => {
  restoreClock();
});

describe('the command palette', () => {
  it('has no chrome: nothing is rendered until the shortcut is used', () => {
    const { container } = render(<Palette />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it(
    'opens on Ctrl+K and on Cmd+K, and the same shortcut closes it',
    async () => {
      render(<Palette />);

      press({ key: 'k', ctrlKey: true });
      expect(useShellStore.getState().paletteOpen).toBe(true);
      expect(await screen.findByPlaceholderText(PLACEHOLDER, undefined, SLOW)).toBeInTheDocument();

      press({ key: 'k', ctrlKey: true });
      expect(useShellStore.getState().paletteOpen).toBe(false);

      press({ key: 'K', metaKey: true });
      expect(useShellStore.getState().paletteOpen).toBe(true);
    },
    FIRST_LOAD_MS,
  );

  it('ignores plain keys, other chords and a held key', () => {
    render(<Palette />);
    press({ key: 'k' });
    press({ key: '/' });
    press({ key: 'l' });
    press({ key: 'k', ctrlKey: true, shiftKey: true });
    press({ key: 'k', ctrlKey: true, altKey: true });
    press({ key: 'k', ctrlKey: true, repeat: true });
    expect(useShellStore.getState().paletteOpen).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('goes to a destination and closes', async () => {
    render(<Palette />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, undefined, SLOW);

    fireEvent.change(input, { target: { value: 'quests' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Quests' }));

    expect(router.push).toHaveBeenCalledWith(ROUTES.quests);
    await waitFor(() => expect(useShellStore.getState().paletteOpen).toBe(false));
  });

  it('reaches the pages that have no nav item', async () => {
    render(<Palette />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, undefined, SLOW);

    fireEvent.change(input, { target: { value: 'impact' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Impact' }));
    expect(router.push).toHaveBeenCalledWith(ROUTES.impact);
  });

  it('starts a log with the quantity that was typed', async () => {
    render(<Palette />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, undefined, SLOW);

    fireEvent.change(input, { target: { value: 'walked 5' } });
    const option = await screen.findByRole('option', { name: /walked or cycled.*5 km/i });
    fireEvent.click(option);

    expect(router.push).toHaveBeenCalledWith(logLink('walk-cycle-instead-of-car', 5));
  });

  it('hands whatever was typed to Moss', async () => {
    render(<Palette />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, undefined, SLOW);

    fireEvent.change(input, { target: { value: 'is oat milk better' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Ask Moss: is oat milk better' }));

    const shell = useShellStore.getState();
    expect(shell.paletteOpen).toBe(false);
    expect(shell.coachOpen).toBe(true);
    expect(shell.coachAsk?.text).toBe('is oat milk better');
  });
});
