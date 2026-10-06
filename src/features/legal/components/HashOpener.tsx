'use client';

import { useEffect } from 'react';

/**
 * Opens the closed folds around the element a link points at, then scrolls to it. Browsers
 * differ on whether a fragment inside a closed `<details>` opens it, and a link from Learn or
 * the coach to one source should land on that source in every one of them.
 */
export function HashOpener() {
  useEffect(() => {
    const open = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      const target = document.getElementById(decodeURIComponent(hash));
      if (!target) return;
      let changed = false;
      for (
        let node: Element | null = target;
        node;
        node = node.parentElement?.closest('details') ?? null
      ) {
        if (node instanceof HTMLDetailsElement && !node.open) {
          node.open = true;
          changed = true;
        }
      }
      if (changed) {
        window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
