import type { ComponentType, ElementType } from 'react';

/** A tag chosen at runtime. JSX cannot check props against an arbitrary element type, so it is treated as a loose component. */
export type LooseTag = ComponentType<Record<string, unknown>>;

export function looseTag(tag: ElementType): LooseTag {
  return tag as unknown as LooseTag;
}
