import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button, type ButtonVariant } from './Button';
import { IconButton } from './IconButton';

const VARIANTS: [ButtonVariant, string][] = [
  ['primary', 'bg-green'],
  ['reward', 'bg-yellow'],
  ['neutral', 'bg-white'],
  ['info', 'bg-blue'],
  ['ink', 'bg-ink'],
  ['danger', 'bg-tomato'],
  ['ghost', 'underline'],
];

describe('Button', () => {
  it.each(VARIANTS)('renders the %s variant with its fill', (variant, expected) => {
    render(<Button variant={variant}>Stick it on</Button>);
    const button = screen.getByRole('button', { name: 'Stick it on' });
    expect(button).toHaveAttribute('data-variant', variant);
    expect(button).toHaveClass(expected);
  });

  it('is a plain button by default, so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('embosses every variant except ghost', () => {
    render(
      <>
        <Button variant="primary">Raised</Button>
        <Button variant="ghost">Flat</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Raised' })).toHaveClass('hard', 'border-3');
    expect(screen.getByRole('button', { name: 'Flat' })).not.toHaveClass('hard');
  });

  it('runs onClick from the mouse, Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Stick it on</Button>);

    await user.click(screen.getByRole('button'));
    await user.tab();
    await user.tab({ shift: true });
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('does nothing while disabled and leaves the tab order', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Stick it on
      </Button>,
    );
    const button = screen.getByRole('button');

    await user.click(button);
    await user.tab();

    expect(button).toBeDisabled();
    expect(button).not.toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays focusable with a reason, but does not act', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabledReason="Name your tree first." onClick={onClick}>
        Plant your tree
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Plant your tree' });

    await user.tab();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Name your tree first.');

    await user.keyboard('{Enter}');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is held while loading: busy, inert, and the label does not change', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button icon={Plus} onClick={onClick}>
        Stick it on
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Stick it on' });
    expect(button).not.toHaveAttribute('aria-busy');

    rerender(
      <Button icon={Plus} loading onClick={onClick}>
        Stick it on
      </Button>,
    );
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAccessibleName('Stick it on');

    button.focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps an icon-less label in place while loading', () => {
    render(<Button loading>Export my data</Button>);
    expect(screen.getByRole('button')).toHaveTextContent(/^Export my data$/);
  });

  it('can dress a link as a button', () => {
    render(
      <Button asChild variant="primary">
        <a href="/log">Log an action</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Log an action' });
    expect(link).toHaveAttribute('href', '/log');
    expect(link).toHaveClass('hard', 'bg-green');
    expect(link).not.toHaveAttribute('type');
  });

  it('shows a check during the success beat', () => {
    const { container } = render(<Button success>Stick it on</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-green');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('takes its accessible name from the label', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Undo" icon={Plus} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('explains why it is unavailable instead of disappearing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton
        label="Undo"
        icon={Plus}
        disabledReason="Nothing to undo yet."
        onClick={onClick}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onClick).not.toHaveBeenCalled();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Nothing to undo yet.');
  });
});
