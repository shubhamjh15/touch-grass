'use client';

import { useRef } from 'react';

/**
 * Radix returns focus only to its own `Trigger`. A dialog opened from state (a row, a shortcut, a
 * menu item) has none, so focus would fall back to `<body>`. This remembers what had focus when the
 * dialog opened and hands it back on close. Spread the result onto `Dialog.Content`.
 */
export function useFocusReturn() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      opener.current = null;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
