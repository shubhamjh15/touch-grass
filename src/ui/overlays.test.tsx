import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import type { EstimateSource } from './estimate';
import { HonestyMark } from './HonestyMark';
import { Modal } from './Modal';
import { Sheet } from './Sheet';
import { mockDesktop } from './testUtils';

function ModalHarness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rename tree
      </button>
      <button type="button">Elsewhere</button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        title="Rename your tree"
        description="It keeps every ring."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Keep it</Button>
            <Button variant="primary">Rename</Button>
          </>
        }
      >
        <label>
          Name
          <input defaultValue="Fern" />
        </label>
      </Modal>
    </>
  );
}

async function expectFocusTrapped(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  const visited = new Set<Element>();
  for (let step = 0; step < 8; step += 1) {
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    if (document.activeElement) visited.add(document.activeElement);
  }
  // The loop went around: more presses than focusable things, and it never left the dialog.
  expect(visited.size).toBeGreaterThan(1);
  expect(visited.size).toBeLessThan(8);
}

describe('Modal', () => {
  it('is a labelled dialog with its description', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Rename tree' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rename your tree' });
    expect(dialog).toHaveAccessibleDescription('It keeps every ring.');
    expect(within(dialog).getByRole('heading', { name: 'Rename your tree' })).toBeInTheDocument();
  });

  it('traps focus while open', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Rename tree' }));
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await expectFocusTrapped(user, dialog);
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    mockDesktop();
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ModalHarness onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Rename tree' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('hands focus back to the opener even when a field in the dialog took focus first', async () => {
    mockDesktop();
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Say it
          </button>
          <Modal open={open} onOpenChange={setOpen} title="Say it">
            <textarea aria-label="Words" ref={(node) => node?.focus()} />
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Say it' });
    await user.click(trigger);
    expect(await screen.findByRole('textbox', { name: 'Words' })).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes from its close button', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Rename tree' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders as a bottom sheet below md, with the same contract', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Rename tree' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Rename your tree' });
    expect(dialog).toHaveClass('bottom-0');
    expect(within(dialog).getByRole('button', { name: 'Rename' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('Sheet', () => {
  function SheetHarness({ modal = true }: { modal?: boolean }) {
    return (
      <>
        <Sheet
          trigger={<button type="button">More</button>}
          title="More"
          modal={modal}
          side={modal ? 'bottom' : 'right'}
          footer={<Button variant="primary">Done</Button>}
        >
          <a href="/impact">Impact</a>
          <a href="/community">Community</a>
        </Sheet>
        <button type="button">Outside</button>
      </>
    );
  }

  it('opens from its trigger as a labelled dialog and traps focus', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);

    await user.click(screen.getByRole('button', { name: 'More' }));
    const dialog = await screen.findByRole('dialog', { name: 'More' });

    expect(within(dialog).getByRole('link', { name: 'Impact' })).toBeInTheDocument();
    await expectFocusTrapped(user, dialog);
  });

  it('closes on Escape and restores focus', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'More' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('always offers a close button, so dragging is never the only way out', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not trap focus when it is not modal, and still closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SheetHarness modal={false} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const dialog = await screen.findByRole('dialog', { name: 'More' });

    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();
    expect(outside).toHaveFocus();
    expect(dialog).toBeInTheDocument();

    within(dialog).getByRole('link', { name: 'Impact' }).focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

const SOURCE: EstimateSource = {
  code: 'MOVE-02',
  kind: 'factor',
  formula: '5 km × 0.171 kg/km = 0.86 kg',
  comparedWith: 'Compared with driving the same trip alone in an average petrol car.',
  range: '0.6–1.1 kg',
  sourceLabel: 'Test dataset',
  year: 2024,
  href: '/methodology#MOVE-02',
};

describe('HonestyMark', () => {
  it('is a named button that opens the estimate in a popover', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<HonestyMark source={SOURCE} />);
    const mark = screen.getByRole('button', { name: 'About this estimate' });
    expect(mark).toHaveAttribute('aria-expanded', 'false');

    await user.click(mark);

    const popover = await screen.findByRole('dialog', { name: 'About this estimate' });
    expect(mark).toHaveAttribute('aria-expanded', 'true');
    expect(within(popover).getByText('MOVE-02')).toBeInTheDocument();
    expect(within(popover).getByText('5 km × 0.171 kg/km = 0.86 kg')).toBeInTheDocument();
    expect(within(popover).getByText(/driving the same trip alone/)).toBeInTheDocument();
    expect(within(popover).getByText('0.6–1.1 kg')).toBeInTheDocument();
    expect(within(popover).getByText('Test dataset, 2024')).toBeInTheDocument();
    expect(within(popover).getByRole('link', { name: 'Open methodology' })).toHaveAttribute(
      'href',
      '/methodology#MOVE-02',
    );
  });

  it('opens from the keyboard, closes on Escape and returns focus', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<HonestyMark source={SOURCE} />);
    const mark = screen.getByRole('button', { name: 'About this estimate' });

    await user.tab();
    expect(mark).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(mark).toHaveFocus());
  });

  it('says so when the estimate came from the AI', async () => {
    mockDesktop();
    const user = userEvent.setup();
    render(<HonestyMark source={{ ...SOURCE, kind: 'ai' }} />);

    await user.click(screen.getByRole('button', { name: 'About this estimate' }));

    expect(await screen.findByText('AI estimate, low confidence')).toBeInTheDocument();
  });

  it('becomes a bottom sheet below md', async () => {
    const user = userEvent.setup();
    render(<HonestyMark source={SOURCE} />);

    await user.click(screen.getByRole('button', { name: 'About this estimate' }));

    const sheet = await screen.findByRole('dialog', { name: 'About this estimate' });
    expect(sheet).toHaveClass('bottom-0');
    expect(within(sheet).getByText('5 km × 0.171 kg/km = 0.86 kg')).toBeInTheDocument();
  });

  it('renders nothing when there is no estimate to explain', () => {
    const { container } = render(<HonestyMark source={{ ...SOURCE, kind: 'none' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
