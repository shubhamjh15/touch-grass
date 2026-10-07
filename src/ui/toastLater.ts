import type { ToastOptions } from './toast';
import { whenToastOutletReady } from './toastOutlet';

/**
 * `toast()` for code that every route loads (the service worker's update notice, the error
 * page, the landing page's demo): the toast library is fetched when the first toast is printed
 * instead of with the page, and the toast waits for the outlet to be on the page.
 */
export function toastLater(options: ToastOptions): void {
  void Promise.all([import('./toast'), whenToastOutletReady()]).then(([module]) => {
    module.toast(options);
  });
}
