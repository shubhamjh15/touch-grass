import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names', () => {
    const active = false as boolean;
    expect(cn('a', active && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind utility override an earlier one', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });
});
