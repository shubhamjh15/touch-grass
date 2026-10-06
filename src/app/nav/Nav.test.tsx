import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameActions } from '@/game';
import { useShellStore } from '../shellStore';
import { MoreSheet } from './MoreSheet';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/quests',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  gameActions.resetAll();
  act(() => {
    useShellStore.setState({ moreOpen: false, paletteOpen: false, coachOpen: false });
  });
});

describe('<TopBar>', () => {
  it('names the current page for assistive tech and shows every primary destination', () => {
    render(<TopBar section="quests" />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quests' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const label of ['Today', 'Log', 'Learn']) {
      const link = within(nav).getByRole('link', { name: label });
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('reaches the palette and the coach without the keyboard', () => {
    render(<TopBar section="today" />);
    fireEvent.click(screen.getByRole('button', { name: 'Search and commands' }));
    expect(useShellStore.getState().paletteOpen).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Ask Moss/ }));
    expect(useShellStore.getState().coachOpen).toBe(true);
  });
});

describe('<TabBar> and <MoreSheet>', () => {
  it('puts Log in the middle and marks the current tab', () => {
    render(<TabBar section="quests" />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quests' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Log an action' })).toHaveAttribute(
      'href',
      '/log',
    );
    expect(within(nav).getByRole('button', { name: /More/ })).toBeInTheDocument();
  });

  it('opens a named More sheet that reaches every other destination', () => {
    render(
      <>
        <TabBar section="today" />
        <MoreSheet section="today" />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    const sheet = screen.getByRole('dialog', { name: 'More' });
    const pages = within(sheet).getByRole('navigation', { name: 'More pages' });
    for (const label of ['Impact', 'Community', 'Moss', 'Me', 'Search', 'Methodology', 'Privacy']) {
      expect(within(pages).getByText(label)).toBeInTheDocument();
    }
  });

  it('closes the sheet and opens the palette from the Search tile', () => {
    render(
      <>
        <TabBar section="today" />
        <MoreSheet section="today" />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    fireEvent.click(screen.getByText('Search'));
    expect(useShellStore.getState().paletteOpen).toBe(true);
    expect(useShellStore.getState().moreOpen).toBe(false);
  });
});
