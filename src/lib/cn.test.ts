import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names', () => {
    const active = false as boolean;
    expect(cn('a', active && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind utility override an earlier one', () => {
    expect(cn('text-sm p-2', 'p-4')).toBe('text-sm p-4');
  });

  it('keeps a design-system type size next to a text colour', () => {
    expect(cn('text-body-sm text-ink')).toBe('text-body-sm text-ink');
    expect(cn('text-h3', 'text-ink-2', 'text-label')).toBe('text-ink-2 text-label');
    expect(cn('text-ink', 'text-green-deep')).toBe('text-green-deep');
  });

  it("resolves the design system's own scales", () => {
    expect(cn('rounded-ctl', 'rounded-pill')).toBe('rounded-pill');
    expect(cn('shadow-3', 'shadow-plate')).toBe('shadow-plate');
    expect(cn('animate-stick', 'animate-peel')).toBe('animate-peel');
    expect(cn('hard lift-5', 'lift-3')).toBe('hard lift-3');
    expect(cn('diecut dc-4', 'dc-6')).toBe('diecut dc-6');
  });
});
