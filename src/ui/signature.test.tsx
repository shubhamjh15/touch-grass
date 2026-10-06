import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMotionPreference } from '@/lib/hooks';
import { Approx } from './Approx';
import { NumberTicker } from './NumberTicker';
import { Sticker } from './Sticker';
import { STICKER_SHAPES } from './stickerShapes';
import { installPointerCapture, mockReducedMotion } from './testUtils';
import { dismissToast, toast } from './toast';
import { Toaster } from './Toaster';
import { CATEGORY_IDS, CATEGORY_ORDER } from './tokens';

installPointerCapture();

describe('NumberTicker', () => {
  afterEach(() => setMotionPreference('system'));

  it('keeps the real value as text and hides the rolling columns from assistive tech', () => {
    const { container } = render(<NumberTicker value={1284} />);

    expect(container.querySelector('.sr-only')).toHaveTextContent('1,284');
    const columns = container.querySelector('[data-ticker]');
    expect(columns).toHaveAttribute('aria-hidden', 'true');
    // Four digit columns of ten glyphs each, plus the separator.
    expect(columns?.querySelectorAll('.invisible')).toHaveLength(4);
  });

  it('swaps instead of rolling when the OS asks for reduced motion', () => {
    mockReducedMotion();
    const { container, rerender } = render(<NumberTicker value={1284} />);

    expect(container.querySelector('[data-ticker]')).not.toBeInTheDocument();
    expect(container).toHaveTextContent(/^1,284$/);

    rerender(<NumberTicker value={1321} />);
    expect(container).toHaveTextContent(/^1,321$/);
  });

  it('follows the in-app Motion setting, in both directions', () => {
    const { container } = render(<NumberTicker value={42} />);
    expect(container.querySelector('[data-ticker]')).toBeInTheDocument();

    act(() => setMotionPreference('reduced'));
    return waitFor(() => expect(container.querySelector('[data-ticker]')).not.toBeInTheDocument());
  });

  it('lets "Full" override an OS that prefers reduced motion', () => {
    mockReducedMotion();
    setMotionPreference('full');
    const { container } = render(<NumberTicker value={42} />);
    expect(container.querySelector('[data-ticker]')).toBeInTheDocument();
  });

  it('formats through the given formatter', () => {
    mockReducedMotion();
    render(<NumberTicker value={0.86} format={(value) => `${value.toFixed(2)} kg`} />);
    expect(screen.getByText('0.86 kg')).toBeInTheDocument();
  });
});

describe('toast', () => {
  afterEach(() => {
    act(() => dismissToast());
  });

  it('prints a status toast with its title and meta', async () => {
    render(<Toaster />);

    act(() => {
      toast({ title: 'Stuck. Fern grew 6 leaves.', meta: '+30 XP', category: 'move' });
    });

    const card = await screen.findByRole('status');
    expect(card).toHaveTextContent('Stuck. Fern grew 6 leaves.');
    expect(card).toHaveTextContent('+30 XP');
  });

  it('runs its action once and then goes away', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<Toaster />);

    act(() => {
      toast({ title: 'Stuck.', action: { label: 'Undo', onClick: onUndo } });
    });
    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText('Stuck.')).not.toBeInTheDocument());
  });

  it('raises errors as alerts that stay until dismissed', async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    act(() => {
      toast({
        title: "Couldn't reach Moss.",
        meta: 'Your message is still in the box.',
        tone: 'danger',
      });
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't reach Moss.");
    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('prints each toast once even when two outlets are mounted', async () => {
    render(
      <>
        <Toaster />
        <Toaster />
      </>,
    );

    act(() => {
      toast({ title: 'Fireflies arrived.' });
    });

    expect(await screen.findAllByText('Fireflies arrived.')).toHaveLength(1);
  });

  it('replaces a toast that reuses an id', async () => {
    render(<Toaster />);

    act(() => {
      toast({ id: 'log', title: 'Stuck. 1 action.' });
    });
    await screen.findByText('Stuck. 1 action.');
    act(() => {
      toast({ id: 'log', title: 'Stuck. 2 actions.' });
    });

    expect(await screen.findByText('Stuck. 2 actions.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Stuck. 1 action.')).not.toBeInTheDocument());
  });
});

describe('Sticker and tokens', () => {
  it('gives every category its own silhouette, so colour is never the only signal', () => {
    const shapes = CATEGORY_IDS.map((id) => STICKER_SHAPES[id].d);
    const names = CATEGORY_IDS.map((id) => STICKER_SHAPES[id].name);
    expect(new Set(shapes).size).toBe(CATEGORY_IDS.length);
    expect(new Set(names).size).toBe(CATEGORY_IDS.length);
  });

  it('keeps the canonical category order complete', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual([...CATEGORY_IDS].sort());
    expect(CATEGORY_ORDER.at(-1)).toBe('nature');
  });

  it('is a labelled image when static and a button when it can be pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Sticker category="move" label="Bike it" />);
    expect(screen.getByRole('img', { name: 'Bike it' })).toHaveAttribute('data-shape', 'ticket');

    rerender(<Sticker category="move" label="Bike it" onClick={onClick} selected />);
    const button = screen.getByRole('button', { name: 'Bike it' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<Sticker category="move" label="Bike it" onClick={onClick} disabled />);
    await user.click(screen.getByRole('button', { name: 'Bike it' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('draws the approx glyph and speaks it', () => {
    const { container } = render(
      <p>
        <Approx />
        0.86 kg
      </p>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('approximately 0.86 kg');
  });
});
