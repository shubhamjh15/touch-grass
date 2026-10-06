import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGameState, selectHud } from '@/game';
import { useShellStore } from '../shellStore';
import { resetShell, restoreClock, seedGame, setViewport } from '../test/harness';
import { AppLayout } from './AppLayout';

let pathname = '/today';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The coach panel and the palette are lazy chunks; the chrome is what is under test here.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

let now = 0;

function renderShell(path: string) {
  pathname = path;
  return render(
    <AppLayout>
      <h1>Page</h1>
    </AppLayout>,
  );
}

const linkNames = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((link) => [
      link.getAttribute('aria-label') ?? link.textContent,
      link.getAttribute('href'),
    ]);

beforeEach(() => {
  now = seedGame('day12');
  resetShell();
});

afterEach(() => {
  restoreClock();
});

describe('the app shell on a desk', () => {
  beforeEach(() => setViewport('desktop'));

  it('shows the five destinations in the top bar, and no tab bar', () => {
    renderShell('/today');
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    expect(navs).toHaveLength(1);
    expect(linkNames(navs[0] as HTMLElement)).toEqual([
      ['Today', '/today'],
      ['Log', '/log'],
      ['Quests', '/quests'],
      ['Learn', '/learn'],
      ['Me', '/me'],
    ]);
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Quests' })).not.toHaveAttribute('aria-current');
  });

  it('carries the streak, the level and the way to the profile, and nothing else', () => {
    renderShell('/quests');
    const hud = selectHud(getGameState(), now);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('day streak').parentElement).toHaveTextContent(
      String(hud.streak),
    );
    expect(within(banner).getByText('Level').parentElement).toHaveTextContent(String(hud.level));
    expect(within(banner).getByRole('link', { name: 'Your profile' })).toHaveAttribute(
      'href',
      '/me',
    );
    // No search chip, no coach button and no CO2e total in the bar.
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument();
    expect(within(banner).queryByRole('searchbox')).not.toBeInTheDocument();
    expect(banner).not.toHaveTextContent(/kg|CO2/i);
  });

  it('keeps Me marked while Impact, Community or the Coach is showing', () => {
    for (const path of ['/impact', '/community', '/coach']) {
      const view = renderShell(path);
      expect(screen.getByRole('link', { name: 'Me' })).toHaveAttribute('aria-current', 'page');
      view.unmount();
    }
  });

  it('marks Learn while a lesson is open', () => {
    renderShell('/learn/the-blanket');
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  });

  it('wraps the page in the one main landmark', () => {
    renderShell('/log');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Page' })).toBeInTheDocument();
  });
});

describe('the app shell on a phone', () => {
  beforeEach(() => setViewport('phone'));

  it('shows Today, Quests, Log, Learn, Me in the tab bar with Log in the middle', () => {
    renderShell('/quests');
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    expect(navs).toHaveLength(1);
    expect(linkNames(navs[0] as HTMLElement)).toEqual([
      ['Today', '/today'],
      ['Quests', '/quests'],
      ['Log an action', '/log'],
      ['Learn', '/learn'],
      ['Me', '/me'],
    ]);
    expect(screen.getByRole('link', { name: 'Quests' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the streak and the level in a strip without links to the destinations', () => {
    renderShell('/today');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('day streak')).toBeInTheDocument();
    expect(within(banner).getByText('Level')).toBeInTheDocument();
    expect(within(banner).queryByRole('navigation')).not.toBeInTheDocument();
    expect(within(banner).queryByRole('link', { name: 'Your profile' })).not.toBeInTheDocument();
  });
});

describe('the Ask Moss button', () => {
  beforeEach(() => setViewport('phone'));

  it('opens the coach drawer and then steps aside', () => {
    renderShell('/today');
    fireEvent.click(screen.getByRole('button', { name: 'Ask Moss' }));
    expect(useShellStore.getState().coachOpen).toBe(true);
    expect(screen.queryByRole('button', { name: 'Ask Moss' })).not.toBeInTheDocument();
  });

  it('is not shown on the coach page, where the conversation is the page', () => {
    renderShell('/coach');
    expect(screen.queryByRole('button', { name: 'Ask Moss' })).not.toBeInTheDocument();
  });
});

describe('hiding the chrome', () => {
  it('puts the bars and the button away while a page needs the whole screen', () => {
    setViewport('phone');
    renderShell('/today');
    let release: () => void = () => undefined;
    act(() => {
      release = useShellStore.getState().hideChrome();
    });
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask Moss' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page' })).toBeInTheDocument();

    act(() => release());
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
