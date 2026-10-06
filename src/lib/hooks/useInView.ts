'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * True while the element is on screen (by `threshold`), false otherwise. For pausing something
 * that moves, such as the tree's idle, once it scrolls out of view: the observer does the watching,
 * so no scroll listener is involved.
 */
export function useInView<T extends Element>(threshold = 0): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
