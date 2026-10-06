import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVACY_LEAVES, PRIVACY_STORED } from '@/data/content';
import { STORAGE_KEYS, game, gameActions, getGameState, type GameState } from '@/game';
import { LEAVES_NAMES, STORED_NAMES } from './copy';
import PrivacyPage from './PrivacyPage';

vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  emitPulse: vi.fn(),
}));

type Fixture = Record<string, { state: GameState; version: number } | undefined>;

/** Puts a saved game on the device exactly as the screenshot fixtures do, and loads it. */
function seed(name: string): void {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Fixture)[STORAGE_KEYS.game];
  if (saved) localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  game.rehydrate();
  gameActions.tick();
}

let download: { name: string; text: string } | null;

beforeEach(() => {
  download = null;
  gameActions.resetAll();
  const blobs = new Map<string, Blob>();
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href);
    if (!blob) return;
    const reader = new FileReader();
    const name = this.download;
    reader.onload = () => {
      download = { name, text: String(reader.result) };
    };
    reader.readAsText(blob);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  gameActions.resetAll();
});

describe('the privacy page', () => {
  it('tells the three-line story and lists everything stored and everything that can leave', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    const ticket = screen.getByRole('group', { name: 'Privacy in three lines' });
    expect(within(ticket).getByText('Only coach messages')).toBeInTheDocument();
    expect(within(ticket).getByText('None')).toBeInTheDocument();

    for (const item of PRIVACY_STORED) {
      expect(document.getElementById(`stored-${item.id}`)).not.toBeNull();
      // Every item is titled in plain words, never by its internal id.
      expect(STORED_NAMES[item.id]).toBeTruthy();
    }
    for (const item of PRIVACY_LEAVES) expect(LEAVES_NAMES[item.id]).toBeTruthy();
    expect(screen.getByText('touchgrass:game')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(
      PRIVACY_LEAVES.length,
    );
  });

  it('keeps what each stored item holds behind its own disclosure', async () => {
    const user = userEvent.setup();
    render(<PrivacyPage />);
    const fold = document.getElementById('stored-coach') as HTMLDetailsElement;
    expect(fold.open).toBe(false);
    await user.click(within(fold).getByText('Coach conversation'));
    expect(fold.open).toBe(true);
    expect(within(fold).getByText(/your messages and its answers/)).toBeVisible();
  });

  it('offers a first-time visitor the way to start instead of buttons that would do nothing', async () => {
    render(<PrivacyPage />);
    expect(await screen.findByText('Nothing is saved on this device yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete everything' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plant your tree' })).toHaveAttribute('href', '/start');
  });

  describe('with a saved tree', () => {
    beforeEach(() => seed('day45'));

    it('exports the saved state as a named JSON file and says so', async () => {
      const user = userEvent.setup();
      render(<PrivacyPage />);
      await user.click(await screen.findByRole('button', { name: 'Export everything' }));
      expect(await screen.findByRole('status')).toHaveTextContent(
        /touch-grass-\d{4}-\d{2}-\d{2}\.json/,
      );
      await vi.waitFor(() => expect(download).not.toBeNull());
      expect(download?.name).toMatch(/^touch-grass-\d{4}-\d{2}-\d{2}\.json$/);
      expect(JSON.parse(download?.text ?? '{}')).toHaveProperty('app', 'touchgrass');
    });

    it('exports the logs as a spreadsheet', async () => {
      const user = userEvent.setup();
      render(<PrivacyPage />);
      await user.click(await screen.findByRole('button', { name: 'Export logs as CSV' }));
      await vi.waitFor(() => expect(download).not.toBeNull());
      expect(download?.name).toMatch(/\.csv$/);
      expect(download?.text.split('\n').length).toBeGreaterThan(2);
    });

    it('asks before deleting, keeps everything on cancel and erases it on confirm', async () => {
      const user = userEvent.setup();
      render(<PrivacyPage />);
      await user.click(await screen.findByRole('button', { name: 'Delete everything' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Delete everything on this device?',
      });

      await user.click(within(dialog).getByRole('button', { name: 'Keep my data' }));
      expect(getGameState().profile.treeName).not.toBe('');
      expect(localStorage.getItem(STORAGE_KEYS.game)).not.toBeNull();

      await user.click(await screen.findByRole('button', { name: 'Delete everything' }));
      const again = await screen.findByRole('dialog');
      await user.click(within(again).getByRole('button', { name: 'Delete everything' }));

      expect(await screen.findByText('Nothing is saved on this device yet')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/Everything was deleted/);
      expect(getGameState().logs).toHaveLength(0);
    });
  });
});
