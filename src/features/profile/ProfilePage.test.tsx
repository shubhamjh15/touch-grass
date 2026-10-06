import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { game, gameActions, getGameState } from '@/game';
import ProfilePage from './ProfilePage';
import { at, seed } from './testHarness';

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));

vi.mock('next/navigation', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
    usePathname: () => '/me',
    useSearchParams: () => React.useMemo(() => new URLSearchParams(nav.search), []),
  };
});

vi.mock('@/world', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
    emitPulse: vi.fn(),
  };
});

const downloads = vi.hoisted(() => [] as { name: string; text: string }[]);

vi.mock('./model/dataFiles', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    downloadText: (name: string, text: string) => {
      downloads.push({ name, text });
    },
  };
});

vi.mock('@/ai', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getAiStatus: () =>
      Promise.resolve({ configured: false, provider: null, model: null, reason: 'not_configured' }),
  };
});

beforeEach(() => {
  nav.search = '';
  nav.replace.mockClear();
  downloads.length = 0;
  game.setClock(() => at(10, 30));
});

afterEach(() => {
  game.setClock(() => Date.now());
  gameActions.resetAll();
});

const open = (tab: string) => userEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));

describe('the passport and badges', () => {
  it('shows the tree, its stage and the ring summary', () => {
    seed('day45');
    render(<ProfilePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Me' })).toBeInTheDocument();
    const passport = screen.getByRole('region', { name: 'Tree passport' });
    expect(within(passport).getByText('Fern')).toBeInTheDocument();
    expect(within(passport).getAllByText(/Young tree/).length).toBeGreaterThan(0);
    expect(within(passport).getByText(/rings: \d+ thick, \d+ thin\./)).toBeInTheDocument();
  });

  it('lists every badge and filters to the earned ones', async () => {
    seed('day45');
    render(<ProfilePage />);
    const grid = screen.getByRole('list', { name: 'Badges' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(33);
    await userEvent.click(screen.getByRole('button', { name: /^Earned/ }));
    const earned = within(screen.getByRole('list', { name: 'Badges' })).getAllByRole('listitem');
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.length).toBeLessThan(33);
  });

  it('opens a locked badge to show how to earn it, and keeps a secret one a riddle', async () => {
    seed('day1');
    render(<ProfilePage />);
    const locked = screen.getAllByRole('button', { name: /not earned yet/ })[0];
    if (!locked) throw new Error('no locked badge');
    await userEvent.click(locked);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('list', { name: 'Tiers' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const secretButton = screen.getAllByRole('button', {
      name: 'Secret badge. Show the riddle',
    })[0];
    if (!secretButton) throw new Error('no secret badge');
    await userEvent.click(secretButton);
    const secret = await screen.findByRole('dialog');
    expect(within(secret).queryByRole('list', { name: 'Tiers' })).not.toBeInTheDocument();
  });

  it('points a first run at the first action', () => {
    seed('day1');
    render(<ProfilePage />);
    expect(screen.getByRole('link', { name: 'Log an action' })).toHaveAttribute('href', '/log');
  });
});

describe('the island log', () => {
  it('writes the arrivals in words and lists what is still to come', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Island');
    const log = screen.getByRole('list', { name: 'Island log' });
    expect(within(log).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Island props still to arrive' })).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('applies a setting at once and keeps it in the store', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Settings');
    await userEvent.click(screen.getByRole('radio', { name: 'Reduced' }));
    expect(getGameState().settings.motion).toBe('reduced');
    await userEvent.click(screen.getByRole('switch', { name: /Sound/ }));
    expect(getGameState().settings.sound).toBe(false);
  });

  it('renames the tree and refuses an empty name with a reason', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Settings');
    const field = screen.getByRole('textbox', { name: /Tree.s name/ });
    await userEvent.clear(field);
    await userEvent.type(field, 'Birch');
    fireEvent.blur(field);
    expect(getGameState().profile.treeName).toBe('Birch');
    await userEvent.clear(field);
    fireEvent.blur(field);
    expect(await screen.findByText('Give your tree a name.')).toBeInTheDocument();
    expect(getGameState().profile.treeName).toBe('Birch');
  });

  it('keeps focus areas between one and three', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Settings');
    const group = screen.getByRole('group', { name: 'Focus areas' });
    const pressed = within(group).getAllByRole('button', { pressed: true });
    for (const chip of pressed.slice(1)) await userEvent.click(chip);
    const last = within(group).getAllByRole('button', { pressed: true })[0];
    if (!last) throw new Error('no focus chip');
    await userEvent.click(last);
    expect(getGameState().profile.focus).toHaveLength(1);
    expect(screen.getByText('Keep at least one.')).toBeInTheDocument();
  });

  it('takes the starting-line quiz and saves a result', async () => {
    seed('day1');
    render(<ProfilePage />);
    await open('Settings');
    await userEvent.click(screen.getByRole('button', { name: 'Take the quiz' }));
    const dialog = await screen.findByRole('dialog');
    for (let step = 0; step < 6; step += 1) {
      const first = within(dialog).getAllByRole('radio')[0];
      if (!first) throw new Error('no answer');
      await userEvent.click(first);
      const next = within(dialog).queryByRole('button', { name: 'Next' });
      if (next) await userEvent.click(next);
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save result' }));
    await waitFor(() => expect(getGameState().baseline.current).not.toBeNull());
  }, 30000);
});

describe('your data', () => {
  it('exports the save as a file', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Data');
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toMatch(/^touch-grass-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(downloads[0]?.text ?? '') as { app: string };
    expect(parsed.app).toBe('touchgrass');
  });

  it('refuses a file that is not a save, says why and changes nothing', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Data');
    const before = getGameState().profile.treeName;
    const input = screen.getByLabelText('Choose an export file to import');
    await userEvent.upload(
      input,
      new File(['not json at all'], 'x.json', { type: 'application/json' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn.t a save file/);
    expect(getGameState().profile.treeName).toBe(before);
  });

  it('previews a real export and replaces data only after the word is typed', async () => {
    seed('day45');
    const text = gameActions.exportState();
    gameActions.updateProfile({ treeName: 'Changed' });
    render(<ProfilePage />);
    await open('Data');
    await userEvent.upload(
      screen.getByLabelText('Choose an export file to import'),
      new File([text], 'save.json', { type: 'application/json' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Fern · \d+ rings/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Replace data' });
    await userEvent.click(confirm);
    expect(getGameState().profile.treeName).toBe('Changed');
    await userEvent.type(within(dialog).getByRole('textbox'), 'replace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace data' }));
    await waitFor(() => expect(getGameState().profile.treeName).toBe('Fern'));
  });

  it('resets only after the tree name is typed, then leaves for the landing page', async () => {
    seed('day45');
    render(<ProfilePage />);
    await open('Data');
    await userEvent.click(screen.getByRole('button', { name: 'Reset Touch Grass' }));
    const dialog = await screen.findByRole('dialog');
    const go = within(dialog).getByRole('button', { name: 'Reset everything' });
    await userEvent.click(go);
    expect(getGameState().logs.length).toBeGreaterThan(0);
    await userEvent.type(within(dialog).getByRole('textbox'), 'fern');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset everything' }));
    expect(getGameState().logs).toHaveLength(0);
    expect(nav.replace).toHaveBeenCalledWith('/');
  });
});
