import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '@/data/catalogue';
import { FACTORS_VERSION } from '@/data/content';
import MethodologyPage from './MethodologyPage';

vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  emitPulse: vi.fn(),
}));

// Tests that click or type through the whole page (51 table rows, 55 sources) need more than the
// default five seconds when the full suite runs on a busy machine.
const FULL_PAGE_INTERACTION_MS = 20_000;

describe('the methodology page', () => {
  it('has one h1, the factor version and the sections a reader looks for', () => {
    render(<MethodologyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Methodology' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`FACTORS ${FACTORS_VERSION}`))).toBeInTheDocument();
    for (const name of ['Every factor', 'Sources', 'What we do not claim']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('navigation', { name: 'On this page' }).length).toBeGreaterThan(0);
  });

  it('prints one table row per action, each a jump target for the app links', () => {
    render(<MethodologyPage />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(ACTIONS.length + 1);
    expect(document.getElementById(`action-${ACTIONS[0]?.id}`)).not.toBeNull();
    expect(document.getElementById('source-desnz2026')).not.toBeNull();
  });

  it(
    'narrows the table with a category chip and the search box, and says what is shown',
    async () => {
      const user = userEvent.setup();
      render(<MethodologyPage />);
      const total = ACTIONS.length;
      await user.click(screen.getByRole('button', { name: /^Eat/ }));
      const eat = ACTIONS.filter((action) => action.category === 'eat').length;
      expect(screen.getByText(new RegExp(`Showing ${eat} of ${total}`))).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^All/ }));
      await user.type(screen.getByRole('searchbox', { name: `Search ${total} actions` }), 'zzzzzz');
      expect(screen.getByRole('heading', { name: 'No action matches that' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(total + 1);
    },
    FULL_PAGE_INTERACTION_MS,
  );

  it(
    'keeps the working of an estimate behind a disclosure',
    async () => {
      const user = userEvent.setup();
      render(<MethodologyPage />);
      const row = document.getElementById('action-walk-cycle-instead-of-car');
      expect(row).not.toBeNull();
      const details = (row as HTMLElement).querySelector('details');
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute('open');
      await user.click(within(row as HTMLElement).getByText('Show working'));
      expect(details).toHaveAttribute('open');
    },
    FULL_PAGE_INTERACTION_MS,
  );

  it(
    'lets a reader try the honesty mark and reach the methodology entry',
    async () => {
      const user = userEvent.setup();
      render(<MethodologyPage />);
      await user.click(
        screen.getAllByRole('button', { name: 'About this estimate' })[0] as HTMLElement,
      );
      const link = await screen.findByRole('link', { name: /Open methodology/ });
      expect(link).toHaveAttribute('href', expect.stringMatching(/^\/methodology#action-/));
    },
    FULL_PAGE_INTERACTION_MS,
  );

  it('sends a source name to the publisher in a new tab', () => {
    render(<MethodologyPage />);
    const item = document.getElementById('source-desnz2026');
    const link = within(item as HTMLElement).getAllByRole('link')[0];
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\//));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('states what the app does not claim and keeps the known gaps open', () => {
    render(<MethodologyPage />);
    expect(screen.getByText(/footprint fell by exactly this amount/)).toBeInTheDocument();
    expect(document.getElementById('gaps')).toHaveAttribute('open');
  });

  it('documents the live world figures with their publishers and the snapshot fallback', () => {
    render(<MethodologyPage />);
    const fold = document.getElementById('planet-figures');
    expect(fold).not.toBeNull();
    expect(within(fold as HTMLElement).getByText(/GISTEMP/)).toBeInTheDocument();
    expect(
      within(fold as HTMLElement).getByText(/snapshot saved with the app/),
    ).toBeInTheDocument();
  });
});
