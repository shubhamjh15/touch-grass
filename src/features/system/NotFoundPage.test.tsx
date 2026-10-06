import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, game, gameActions, type GameState } from '@/game';
import NotFoundPage from './NotFoundPage';

vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  emitPulse: vi.fn(),
}));

afterEach(() => gameActions.resetAll());

describe('the 404 page', () => {
  it('says the path leads nowhere, in one h1 inside the only main', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Lost?' })).toBeInTheDocument();
    expect(screen.getByText(/This path leads nowhere/)).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('sends a visitor without a tree to the front door and never redirects', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'how the numbers work' })).toHaveAttribute(
      'href',
      '/methodology',
    );
    expect(screen.getByRole('link', { name: 'what stays on your device' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('sends someone who has a tree back to the grove', () => {
    const file = path.resolve('scripts/fixtures', 'day12.json');
    const saved = (
      JSON.parse(readFileSync(file, 'utf8')) as Record<string, { state: GameState } | undefined>
    )[STORAGE_KEYS.game];
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
    game.rehydrate();
    render(<NotFoundPage />);
    expect(screen.getByRole('link', { name: 'Back to the grove' })).toHaveAttribute(
      'href',
      '/today',
    );
  });
});
