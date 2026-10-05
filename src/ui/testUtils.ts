import { vi } from 'vitest';

/**
 * Makes `window.matchMedia` answer from a predicate for the current test (restored automatically).
 * `mockMatchMedia((query) => query.includes('min-width'))` = a desktop viewport.
 */
export function mockMatchMedia(matches: (query: string) => boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

/** jsdom has no pointer capture; Radix and sonner call it during drags. */
export function installPointerCapture(): void {
  const proto = Element.prototype as Partial<Element>;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.hasPointerCapture ??= () => false;
}

/** A wide viewport with a mouse: every `min-width` and fine-pointer query matches; reduced motion does not. */
export function mockDesktop(): void {
  mockMatchMedia((query) => !query.includes('prefers-reduced-motion'));
}

/** Any viewport, with the OS asking for reduced motion. */
export function mockReducedMotion(): void {
  mockMatchMedia((query) => query.includes('prefers-reduced-motion'));
}
