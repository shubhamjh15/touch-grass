import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Input, SearchInput, Textarea } from './Input';
import { Segmented } from './Segmented';
import { Switch } from './Switch';
import { TabPanel, Tabs } from './Tabs';

describe('Field', () => {
  it('ties the visible label to its control', async () => {
    const user = userEvent.setup();
    render(
      <Field label="Name your tree">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Name your tree');

    await user.click(screen.getByText('Name your tree'));

    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('describes the control with its hint', () => {
    render(
      <Field label="Name your tree" hint="You can rename it any time.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name your tree')).toHaveAccessibleDescription(
      'You can rename it any time.',
    );
  });

  it('announces an error and marks the control invalid', () => {
    const { rerender } = render(
      <Field label="Distance" hint="In kilometres.">
        <Input />
      </Field>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <Field label="Distance" hint="In kilometres." error="That's more than a day can hold. Typo?">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Distance');
    expect(screen.getByRole('alert')).toHaveTextContent("That's more than a day can hold. Typo?");
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      "That's more than a day can hold. Typo? In kilometres.",
    );
  });

  it('spells out "required" instead of relying on an asterisk', () => {
    render(
      <Field label="Name your tree" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Name your tree/);
    expect(screen.getByText('(required)')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('wires a textarea the same way', () => {
    render(
      <Field label="Journal note" error="Too long for one note.">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByLabelText('Journal note');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Too long for one note.');
  });

  it('lets an explicit id win over the generated one', () => {
    render(
      <Field label="Name">
        <Input id="tree-name" />
      </Field>,
    );
    expect(document.getElementById('tree-name')).toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('is named, and clears from its button with focus back in the field', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <SearchInput
          value={value}
          onValueChange={setValue}
          label="Search 42 actions"
          resultCount={3}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: 'Search 42 actions' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    await user.type(input, 'bike');
    expect(input).toHaveValue('bike');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });
});

describe('Switch', () => {
  function Harness({ onChange }: { onChange?: (checked: boolean) => void }) {
    const [checked, setChecked] = useState(false);
    return (
      <Switch
        checked={checked}
        onCheckedChange={(next) => {
          setChecked(next);
          onChange?.(next);
        }}
        label="Sound"
        description="Paper sounds: peel, stick, stamp, tear."
      />
    );
  }

  it('is a labelled, described switch', () => {
    render(<Harness />);
    const control = screen.getByRole('switch', { name: 'Sound' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control).toHaveAccessibleDescription('Paper sounds: peel, stick, stamp, tear.');
  });

  it('toggles from the keyboard with Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Sound' });

    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('toggles when its label is pressed: the whole row is the target', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Sound'));

    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'true');
  });

  it('does not toggle while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Sync" disabled />);

    await user.click(screen.getByRole('switch', { name: 'Sync' }));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  function Harness() {
    const [tab, setTab] = useState('daily');
    return (
      <Tabs
        aria-label="Quests"
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'daily', label: 'Daily', count: 3 },
          { value: 'weekly', label: 'Weekly' },
          { value: 'epic', label: 'Epics' },
        ]}
      >
        <TabPanel value="daily">Three a day</TabPanel>
        <TabPanel value="weekly">Three a week</TabPanel>
        <TabPanel value="epic">Long projects</TabPanel>
      </Tabs>
    );
  }

  it('shows the selected panel and marks its tab', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Quests' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Daily/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Three a day');
  });

  it('moves with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const daily = screen.getByRole('tab', { name: /Daily/ });
    const weekly = screen.getByRole('tab', { name: 'Weekly' });
    const epic = screen.getByRole('tab', { name: 'Epics' });

    await user.tab();
    expect(daily).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(weekly).toHaveFocus();
    expect(weekly).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Three a week');

    await user.keyboard('{End}');
    expect(epic).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(daily).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(epic).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(daily).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Three a day');
  });

  it('is one tab stop: Tab leaves the list for the panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    await user.tab();

    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });
});

describe('Segmented', () => {
  function Harness({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState('5');
    return (
      <Segmented
        aria-label="Distance"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        options={[
          { value: '1', label: '1 km' },
          { value: '5', label: '5 km' },
          { value: '10', label: '10 km' },
        ]}
      />
    );
  }

  it('exposes one checked option in a named group', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Distance' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '5 km' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '1 km' })).not.toBeChecked();
  });

  it('moves focus with the arrow keys and selects with Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole('radio', { name: '5 km' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '10 km' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: '10 km' })).toBeChecked();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '1 km' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('radio', { name: '1 km' })).toBeChecked();
    expect(onChange.mock.calls).toEqual([['10'], ['1']]);
  });

  it('always keeps one option selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: '5 km' }));

    expect(screen.getByRole('radio', { name: '5 km' })).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});
