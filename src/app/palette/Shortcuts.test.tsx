import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions } from '@/game';
import { logLink, ROUTES } from '../routes';
import { useShellStore } from '../shellStore';
import { Shortcuts } from './Shortcuts';

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

const PLACEHOLDER = 'Search actions, pages, settings…';
const SLOW = { timeout: 8000 };

const press = (init: KeyboardEventInit, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, init);
  });

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  gameActions.resetAll();
  // jsdom has no layout: cmdk only needs the method to exist.
  Element.prototype.scrollIntoView = vi.fn();
  act(() => {
    useShellStore.setState({
      paletteOpen: false,
      paletteQuery: '',
      coachOpen: false,
      shortcutsOpen: false,
    });
  });
});

describe('<Shortcuts> and the command palette', () => {
  it('opens the palette on Ctrl+K and closes it on the same shortcut', async () => {
    render(<Shortcuts />);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();

    press({ key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText(PLACEHOLDER, {}, SLOW)).toBeInTheDocument();
    expect(useShellStore.getState().paletteOpen).toBe(true);

    press({ key: 'k', ctrlKey: true });
    expect(useShellStore.getState().paletteOpen).toBe(false);
  });

  it('opens on Cmd+K and on "/" as well', () => {
    render(<Shortcuts />);
    press({ key: 'k', metaKey: true });
    expect(useShellStore.getState().paletteOpen).toBe(true);

    act(() => useShellStore.getState().setPaletteOpen(false));
    press({ key: '/' });
    expect(useShellStore.getState().paletteOpen).toBe(true);
  });

  it('lists every destination and a few actions before anything is typed', async () => {
    render(<Shortcuts />);
    press({ key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    const list = within(dialog);

    for (const label of ['Today', 'Quests', 'Learn', 'Impact', 'Community', 'Me', 'Privacy']) {
      expect(
        list.getByRole('option', { name: new RegExp(`^${label}(?![a-z])`) }),
      ).toBeInTheDocument();
    }
    expect(list.getByRole('option', { name: /Ask Moss/ })).toBeInTheDocument();
    expect(list.getByRole('option', { name: /Turn sound off/ })).toBeInTheDocument();
    // The Log group suggests actions with a quantity.
    expect(list.getAllByRole('option', { name: /·/ }).length).toBeGreaterThan(0);
  });

  it('finds a catalogue action by synonym and opens Log with it and the quantity prefilled', async () => {
    render(<Shortcuts />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, {}, SLOW);

    fireEvent.change(input, { target: { value: 'log bike 5' } });
    const option = await screen.findByRole(
      'option',
      { name: /Walked or cycled instead of driving.*5 km/ },
      SLOW,
    );
    fireEvent.click(option);

    expect(router.push).toHaveBeenCalledWith(logLink('walk-cycle-instead-of-car', 5));
    expect(useShellStore.getState().paletteOpen).toBe(false);
  });

  it('always offers to ask Moss, so a query without a match still leads somewhere', async () => {
    render(<Shortcuts />);
    press({ key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER, {}, SLOW);

    fireEvent.change(input, { target: { value: 'zzzz qqqq' } });
    const ask = await screen.findByRole('option', { name: 'Ask Moss: zzzz qqqq' });
    fireEvent.click(ask);

    await waitFor(() => expect(useShellStore.getState().coachOpen).toBe(true));
    expect(useShellStore.getState().coachAsk?.text).toBe('zzzz qqqq');
  });

  it('toggles the Sound setting from the palette', async () => {
    render(<Shortcuts />);
    press({ key: 'k', ctrlKey: true });
    const option = await screen.findByRole('option', { name: /Turn sound off/ }, SLOW);
    fireEvent.click(option);
    expect(await screen.findByRole('option', { name: /Turn sound on/ })).toBeInTheDocument();
  });

  it('goes to Log on L, to a page on G then its letter, and opens the coach on C', () => {
    render(<Shortcuts />);
    press({ key: 'l' });
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.log);

    press({ key: 'g' });
    press({ key: 'q' });
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.quests);

    press({ key: 'c' });
    expect(useShellStore.getState().coachOpen).toBe(true);
  });

  it('ignores single keys while the user is typing, but not the palette shortcut', () => {
    render(
      <>
        <Shortcuts />
        <input aria-label="Notes" />
      </>,
    );
    const field = screen.getByLabelText('Notes');
    press({ key: 'l', bubbles: true }, field);
    press({ key: '/', bubbles: true }, field);
    expect(router.push).not.toHaveBeenCalled();
    expect(useShellStore.getState().paletteOpen).toBe(false);

    press({ key: 'k', ctrlKey: true, bubbles: true }, field);
    expect(useShellStore.getState().paletteOpen).toBe(true);
  });

  it('shows the shortcut list on "?"', async () => {
    render(<Shortcuts />);
    press({ key: '?' });
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
});
