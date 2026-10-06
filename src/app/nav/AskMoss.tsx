'use client';

import { MossFace } from '@/ui';
import { openCoach } from '../shellStore';

/**
 * The coach, one tap away on every app screen: bottom-right on a desk, just above the tab
 * bar on a phone. It opens the drawer.
 */
export function AskMoss() {
  return (
    <button
      type="button"
      onClick={() => openCoach()}
      aria-haspopup="dialog"
      className="fixed right-[max(16px,var(--safe-r))] bottom-[calc(var(--tabbar-h)+var(--safe-b)+12px)] z-(--z-fab) inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border-2 border-ink bg-white pr-4 pl-2 text-body-sm font-bold text-ink shadow-1 lg:right-6 lg:bottom-6"
    >
      <MossFace size={26} />
      Ask Moss
    </button>
  );
}
