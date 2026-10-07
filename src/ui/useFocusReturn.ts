'use client';

import { useRef } from 'react';

/**
 * The last thing outside any dialog that had focus. A dialog that focuses its own field as it
 * mounts (a textarea with `autoFocus`) makes Radix skip its "focus the first thing" step, so the
 * opener is never reported; it is read from here when the dialog closes instead.
 */
let lastOutside: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        !target.closest('[role="dialog"],[role="alertdialog"]')
      ) {
        lastOutside = target;
      }
    },
    true,
  );
}

/**
 * Radix returns focus only to its own `Trigger`. A dialog opened from state (a row, a shortcut, a
 * menu item) has none, so focus would fall back to `<body>`. This remembers what had focus when the
 * dialog opened and hands it back on close. Spread the result onto `Dialog.Content`.
 */
export function useFocusReturn() {
  const opener = useRef<HTMLElement | null>(null);
  const heard = useRef(false);
  return {
    onOpenAutoFocus: () => {
      heard.current = true;
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = heard.current ? opener.current : lastOutside;
      heard.current = false;
      opener.current = null;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
