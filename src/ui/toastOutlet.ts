/**
 * Whether a toast outlet is on the page yet. A toast printed before the outlet has mounted is
 * never shown, and on public pages the outlet arrives after the first paint, so code that may
 * run that early waits here first.
 */
let ready = false;
const waiting: (() => void)[] = [];

/** Called by `<Toaster>` once its outlet is listening. */
export function markToastOutletReady(): void {
  if (ready) return;
  ready = true;
  for (const resolve of waiting.splice(0)) resolve();
}

export function whenToastOutletReady(): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    waiting.push(resolve);
  });
}
