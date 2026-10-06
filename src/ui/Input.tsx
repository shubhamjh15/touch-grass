'use client';

import { Search, X, type LucideIcon } from 'lucide-react';
import { useRef, type ComponentProps, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks';
import { useFieldControl } from './fieldContext';
import { IconButton } from './IconButton';

const SHELL =
  'deboss focus-within-ring flex h-12 w-full items-center rounded-ctl border-3 border-ink bg-white text-ink has-[input:focus-visible]:[--deboss:var(--color-yellow-tint)] has-[input:disabled]:border-2 has-[input:disabled]:border-dashed has-[input:disabled]:border-ink-4 has-[input:disabled]:bg-line has-[input:disabled]:text-ink-3 has-[input:disabled]:[--deboss:transparent]';

const INVALID =
  '[--deboss:var(--color-tomato-tint)] has-[input:focus-visible]:[--deboss:var(--color-tomato-tint)]';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Leading 20 px icon. */
  icon?: LucideIcon;
  /** A mono unit cell behind a divider: "km", "min". */
  suffix?: string;
  invalid?: boolean;
  /** Classes for the `<input>` itself (`className` styles the debossed shell). */
  inputClassName?: string;
};

/** A debossed text input. 16 px text, so iOS does not zoom. Put it in a `Field` for its label. */
export function Input({
  icon: Icon,
  suffix,
  invalid,
  className,
  inputClassName,
  id,
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const field = useFieldControl({ id, invalid, 'aria-describedby': describedBy });
  const { invalid: isInvalid, ...control } = field;
  return (
    <div className={cn(SHELL, isInvalid && INVALID, className)}>
      {Icon ? (
        <Icon
          size={20}
          strokeWidth={2.25}
          aria-hidden="true"
          className="ml-3 shrink-0 text-ink-3"
        />
      ) : null}
      <input
        {...control}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent px-3.5 text-body shadow-none outline-hidden placeholder:text-ink-4 disabled:cursor-not-allowed',
          Icon && 'pl-2.5',
          inputClassName,
        )}
        {...rest}
      />
      {suffix ? (
        <span className="grid h-full shrink-0 place-items-center border-l-2 border-ink px-3 font-mono text-data font-semibold text-ink-2">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export type TextareaProps = ComponentProps<'textarea'> & { invalid?: boolean };

export function Textarea({
  invalid,
  className,
  id,
  'aria-describedby': describedBy,
  ...rest
}: TextareaProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({
    id,
    invalid,
    'aria-describedby': describedBy,
  });
  return (
    <textarea
      {...control}
      className={cn(
        'block min-h-24 w-full resize-y rounded-ctl border-3 border-ink bg-white px-3.5 py-3 text-body text-ink deboss placeholder:text-ink-4 focus-visible:[--deboss:var(--color-yellow-tint)] disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-ink-4 disabled:bg-line disabled:text-ink-3',
        isInvalid &&
          '[--deboss:var(--color-tomato-tint)] focus-visible:[--deboss:var(--color-tomato-tint)]',
        className,
      )}
      {...rest}
    />
  );
}

export type SearchInputProps = Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'size'
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name: "Search 42 actions". Also the default placeholder. */
  label: string;
  /** Number of matches for the current query; announced politely once typing pauses. */
  resultCount?: number;
  ref?: Ref<HTMLInputElement>;
};

/** Search field: leading glass, a clear button once there is text, and a polite result count. */
export function SearchInput({
  value,
  onValueChange,
  label,
  resultCount,
  placeholder,
  className,
  ref,
  ...rest
}: SearchInputProps) {
  const inner = useRef<HTMLInputElement | null>(null);
  const announced = useDebouncedValue(
    value && resultCount !== undefined
      ? resultCount === 0
        ? 'No matches'
        : pluralize(resultCount, 'result')
      : '',
    400,
  );

  return (
    <div className={cn(SHELL, className)} role="search">
      <Search
        size={20}
        strokeWidth={2.25}
        aria-hidden="true"
        className="ml-3 shrink-0 text-ink-3"
      />
      <input
        ref={(node) => {
          inner.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        enterKeyHint="search"
        autoComplete="off"
        className="h-full min-w-0 flex-1 appearance-none bg-transparent pr-2 pl-2.5 text-body shadow-none outline-hidden placeholder:text-ink-4 [&::-webkit-search-cancel-button]:appearance-none"
        {...rest}
      />
      {value ? (
        <IconButton
          label="Clear search"
          icon={X}
          size="sm"
          tooltipSide={null}
          className="mr-1.5 [--lift:2px]"
          onClick={() => {
            onValueChange('');
            inner.current?.focus();
          }}
        />
      ) : null}
      <span role="status" className="sr-only">
        {announced}
      </span>
    </div>
  );
}
