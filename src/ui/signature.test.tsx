import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMotionPreference } from '@/lib/hooks';
import { Approx } from './Approx';
import { NumberTicker } from './NumberTicker';
import { Sticker } from './Sticker';
import { STICKER_SHAPES } from './stickerShapes';
import { TearStub, type TearStubState } from './TearStub';
import { installPointerCapture, mockReducedMotion } from './testUtils';
import { dismissToast, toast } from './toast';
import { Toaster } from './Toaster';
import { CATEGORY_IDS, CATEGORY_ORDER, restRotation, restTilt } from './tokens';

installPointerCapture();

/** jsdom has no PointerEvent constructor; a MouseEvent of the same type carries the coordinates. */
function pointer(target: Element, type: string, clientX: number) {
  fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 }));
}

describe('TearStub', () => {
  function Quest({ onClaim }: { onClaim?: () => void }) {
    const [state, setState] = useState<TearStubState>('claimable');
    return (
      <>
        <TearStub
          title="Vampire Slayer"
          description="Switch off three standby devices."
          category="power"
          kind="daily"
          progress={{ value: 3, max: 3 }}
          reward="+50 XP"
          state={state}
          onClaim={() => {
            onClaim?.();
            setState('claimed');
          }}
        />
        <button type="button" onClick={() => setState('claimable')}>
          Undo claim
        </button>
      </>
    );
  }

  it('offers the stub as a named button when the quest is claimable', () => {
    render(<Quest />);
    expect(
      screen.getByRole('button', { name: 'Claim +50 XP for Vampire Slayer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Vampire Slayer progress' })).toHaveAttribute(
      'aria-valuetext',
      '3 of 3',
    );
  });

  it('tears off with Enter, exactly once, and says so', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(<Quest onClaim={onClaim} />);

    await user.tab();
    expect(screen.getByRole('button', { name: /Claim \+50/ })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onClaim).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Claim \+50/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Claimed. Plus 50 XP.');
    expect(screen.getByText('Claimed · +50 XP')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vampire Slayer (claimed)' })).toBeInTheDocument();
  });

  it('tears off with Space too', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(<Quest onClaim={onClaim} />);

    screen.getByRole('button', { name: /Claim \+50/ }).focus();
    await user.keyboard(' ');

    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('can be torn again after the claim is undone', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(<Quest onClaim={onClaim} />);

    await user.click(screen.getByRole('button', { name: /Claim \+50/ }));
    await user.click(screen.getByRole('button', { name: 'Undo claim' }));
    await user.click(screen.getByRole('button', { name: /Claim \+50/ }));

    expect(onClaim).toHaveBeenCalledTimes(2);
  });

  it('claims when the stub is dragged past the tear line, and not when the drag is abandoned', () => {
    const onClaim = vi.fn();
    render(<Quest onClaim={onClaim} />);
    const stub = screen.getByRole('button', { name: /Claim \+50/ });

    pointer(stub, 'pointerdown', 100);
    pointer(stub, 'pointermove', 112);
    pointer(stub, 'pointerup', 112);
    // The browser follows a pointer-up with a click; an abandoned drag must swallow it.
    fireEvent.click(stub);
    expect(onClaim).not.toHaveBeenCalled();

    pointer(stub, 'pointerdown', 100);
    pointer(stub, 'pointermove', 140);
    pointer(stub, 'pointerup', 140);
    fireEvent.click(stub);
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('has no button while the quest is still in progress', () => {
    render(
      <TearStub
        title="Two-Wheel Tuesday"
        progress={{ value: 1, max: 2 }}
        reward="+60 XP"
        state="active"
        onClaim={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('+60 XP', { selector: 'span.font-mono' })).toBeInTheDocument();
  });

  it('names an expired quest as expired', () => {
    render(
      <TearStub
        title="Cold Snap"
        progress={{ value: 0, max: 1 }}
        reward="+40 XP"
        state="expired"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Cold Snap (expired)' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

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

  it('picks rotations and tilts deterministically from the fixed sets', () => {
    expect(restRotation('quest-7')).toBe(restRotation('quest-7'));
    for (const id of ['a', 'bike', 'quest-7', 'Fern', '']) {
      expect([-2, -1, 1, 2]).toContain(restRotation(id));
      const tilt = restTilt(id);
      expect([-6, 0, 6]).toContain(tilt.xrot);
      expect([-12, -8, 8, 12]).toContain(tilt.yrot);
    }
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
