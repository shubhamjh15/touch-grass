'use client';

import { Search, X, type LucideIcon } from 'lucide-react';
import { useRef, type ComponentProps, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks';
import { useFieldControl } from './fieldContext';
import { IconButton } from './IconButton';

const SHELL =
  'focus-within-ring flex h-12 w-full items-center rounded-md border-2 border-ink bg-white text-ink has-[input:disabled]:border-ink-4 has-[input:disabled]:bg-line has-[input:disabled]:text-ink-3';

/** The error sentence and its icon carry the meaning; the tint only supports them. */
const INVALID = 'border-tomato-deep bg-tomato-tint';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Leading 20 px icon. */
  icon?: LucideIcon;
  /** A unit after the value: "km", "min". */
  suffix?: string;
  invalid?: boolean;
  /** Classes for the `<input>` itself (`className` styles the outlined shell). */
  inputClassName?: string;
};

/** A text input: 48 px tall, 16 px text so iOS does not zoom. Put it in a `Field` for its label. */
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
          strokeWidth={1.75}
          aria-hidden="true"
          className="ml-3.5 shrink-0 text-ink-3"
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
        <span className="shrink-0 pr-3.5 text-body font-medium text-ink-3">{suffix}</span>
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
        'block min-h-24 w-full resize-y rounded-md border-2 border-ink bg-white px-3.5 py-3 text-body text-ink placeholder:text-ink-4 disabled:cursor-not-allowed disabled:border-ink-4 disabled:bg-line disabled:text-ink-3',
        isInvalid && INVALID,
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
        strokeWidth={1.75}
        aria-hidden="true"
        className="ml-3.5 shrink-0 text-ink-3"
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
          variant="ghost"
          size="sm"
          tooltipSide={null}
          className="mr-1.5"
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
