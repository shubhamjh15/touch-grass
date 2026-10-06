import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Accordion, Disclosure } from './Accordion';
import { Banner } from './Banner';
import { Button } from './Button';
import { Fab } from './Fab';
import { PageHeader } from './headings';
import { PageContainer, Section } from './PageContainer';
import { ProgressBar } from './ProgressBar';
import { BottomSheet } from './Sheet';
import { Spinner } from './Spinner';
import { installPointerCapture } from './testUtils';

installPointerCapture();

const QUESTIONS = [
  { id: 'numbers', title: 'How accurate are the numbers?', content: 'They are estimates.' },
  { id: 'account', title: 'Do I need an account?', content: 'No. It stays on this device.' },
];

describe('Accordion', () => {
  it('opens one answer at a time and closes it again', async () => {
    const user = userEvent.setup();
    render(<Accordion items={QUESTIONS} />);

    const first = screen.getByRole('button', { name: 'How accurate are the numbers?' });
    const second = screen.getByRole('button', { name: 'Do I need an account?' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('They are estimates.')).not.toBeInTheDocument();

    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('They are estimates.')).toBeInTheDocument();

    await user.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('They are estimates.')).not.toBeInTheDocument();
    expect(screen.getByText('No. It stays on this device.')).toBeInTheDocument();

    await user.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });

  it('works from the keyboard: arrows move between headers, Enter opens', async () => {
    const user = userEvent.setup();
    render(<Accordion items={QUESTIONS} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'How accurate are the numbers?' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    const second = screen.getByRole('button', { name: 'Do I need an account?' });
    expect(second).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts each question in a heading and can start open', () => {
    render(<Accordion items={QUESTIONS} defaultOpen={['account']} headingLevel="h3" />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(screen.getByText('No. It stays on this device.')).toBeInTheDocument();
  });

  it('lets several stay open when asked to', async () => {
    const user = userEvent.setup();
    render(<Accordion items={QUESTIONS} type="multiple" />);
    await user.click(screen.getByRole('button', { name: 'How accurate are the numbers?' }));
    await user.click(screen.getByRole('button', { name: 'Do I need an account?' }));
    expect(screen.getByText('They are estimates.')).toBeInTheDocument();
    expect(screen.getByText('No. It stays on this device.')).toBeInTheDocument();
  });
});

describe('Disclosure', () => {
  it('keeps its content out of the page until it is opened, and shows the count', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure title="Logged today" count={2} onOpenChange={onOpenChange}>
        <p>Cycled to work</p>
      </Disclosure>,
    );

    const trigger = screen.getByRole('button', { name: 'Logged today (2)' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Cycled to work')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Cycled to work')).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

describe('Banner', () => {
  it('is a polite status with a title, a line and one action', () => {
    render(
      <Banner title="Your week is in" action={<a href="/impact">See your impact</a>}>
        Nine actions.
      </Banner>,
    );
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Your week is in');
    expect(banner).toHaveTextContent('Nine actions.');
    expect(within(banner).getByRole('link', { name: 'See your impact' })).toBeInTheDocument();
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument();
  });

  it('goes away when dismissed and reports it once', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Banner title="Your week is in" onDismiss={onDismiss} dismissLabel="Hide the recap" />);

    await user.click(screen.getByRole('button', { name: 'Hide the recap' }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('reports its value to assistive tech, as a percentage by default', () => {
    render(<ProgressBar value={0.5} label="Reading progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '0.5');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
    expect(bar).toHaveAttribute('aria-valuetext', '50%');
  });

  it('speaks the given words and never runs past its end', () => {
    render(<ProgressBar value={7} max={5} label="Walk 5 km" valueText="5 of 5 km" />);
    const bar = screen.getByRole('progressbar', { name: 'Walk 5 km' });
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar).toHaveAttribute('aria-valuetext', '5 of 5 km');
    expect(bar.firstElementChild).toHaveStyle({ transform: 'translateX(0%)' });
  });

  it('moves its fill by transform, so nothing is laid out again', () => {
    render(<ProgressBar size="thin" value={1} max={4} label="Step 1 of 4" />);
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveStyle({ transform: 'translateX(-75%)' });
  });
});

describe('Fab', () => {
  it('is a named button, also when only the icon shows', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Fab label="Ask Moss" iconOnly onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Ask Moss' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('can be a link', () => {
    render(<Fab label="Log an action" href="/log" variant="primary" placement="inline" />);
    expect(screen.getByRole('link', { name: 'Log an action' })).toHaveAttribute('href', '/log');
  });
});

describe('BottomSheet', () => {
  function LogSheet({ onLog }: { onLog: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Cycled to work
        </button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Cycled to work"
          description="How far did you go?"
          footer={
            <Button
              variant="primary"
              onClick={() => {
                onLog();
                setOpen(false);
              }}
            >
              Log it
            </Button>
          }
        >
          <p>5 km</p>
        </BottomSheet>
      </>
    );
  }

  it('opens as a labelled dialog, logs, closes and gives the focus back', async () => {
    const user = userEvent.setup();
    const onLog = vi.fn();
    render(<LogSheet onLog={onLog} />);

    const opener = screen.getByRole('button', { name: 'Cycled to work' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Cycled to work' });
    expect(dialog).toHaveAccessibleDescription('How far did you go?');

    await user.click(within(dialog).getByRole('button', { name: 'Log it' }));
    expect(onLog).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('closes with Esc and with its close button', async () => {
    const user = userEvent.setup();
    render(<LogSheet onLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cycled to work' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Cycled to work' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes when its header is dragged far enough down, and stays for a small nudge', async () => {
    const user = userEvent.setup();
    render(<LogSheet onLog={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Cycled to work' }));
    const dialog = await screen.findByRole('dialog');
    const handle = within(dialog).getByRole('heading', { name: 'Cycled to work' });
    // jsdom lays nothing out, so the sheet needs a height for "far enough" to mean something.
    Object.defineProperty(dialog, 'offsetHeight', { configurable: true, value: 400 });

    const drag = (type: string, clientY: number, timeStamp: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 });
      Object.defineProperty(event, 'timeStamp', { value: timeStamp });
      fireEvent(handle, event);
    };

    drag('pointerdown', 100, 0);
    drag('pointermove', 120, 1000);
    drag('pointerup', 120, 2000);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    drag('pointerdown', 100, 3000);
    drag('pointermove', 320, 4000);
    drag('pointerup', 320, 5000);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Page structure', () => {
  it('gives the page one h1, a lead and a way back', () => {
    render(
      <PageHeader
        title="Why food miles mislead"
        lead="Three minutes."
        back={{ label: 'Learn', href: '/learn' }}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Why food miles mislead' })).toBeInTheDocument();
    expect(screen.getByText('Three minutes.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/learn');
  });

  it('labels each section by its heading and links onward', () => {
    render(
      <PageContainer sections>
        <Section title="Today's quests" meta="Resets in 9 h">
          <p>Three rows</p>
        </Section>
        <Section title="Badges" action={{ label: 'See all', href: '/me' }}>
          <p>Medals</p>
        </Section>
      </PageContainer>,
    );
    const quests = screen.getByRole('region', { name: "Today's quests" });
    expect(quests).toHaveTextContent('Resets in 9 h');
    const badges = screen.getByRole('region', { name: 'Badges' });
    expect(within(badges).getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/me');
  });
});

describe('Spinner', () => {
  it('names what is happening, or stays silent beside a label', () => {
    const { rerender } = render(<Spinner label="Estimating" />);
    expect(screen.getByRole('status', { name: 'Estimating' })).toBeInTheDocument();

    rerender(<Spinner label="" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
