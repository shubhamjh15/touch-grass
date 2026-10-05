'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Flips to true the first time the element is at least `threshold` visible, then stops observing.
 * For "stick in once" entrances: never re-triggered on scroll back.
 */
export function useInViewOnce<T extends Element>(threshold = 0.2): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, threshold]);

  return [ref, seen];
}
