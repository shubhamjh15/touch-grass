/**
 * What each step of the tour says and points at, page by page. A step names the thing to
 * use, not a place on the screen: the selectors are tried in order and the first one that is
 * laid out wins, so the same step finds the top bar on a laptop and the tab bar on a phone.
 */
import { ROUTES, normalizePath } from '@/app/routes';
import { TOUR_COPY, type TourCopy } from '../copy';
import type { TourStepId } from '../model/tour';

export interface StepView {
  copy: TourCopy;
  /** CSS selectors of what the ring goes around; the first visible match wins. */
  anchors: readonly string[];
  /** Draw the ring. Off where the target is the whole page (the world, a page to read). */
  ring: boolean;
}

/** The world's stage on a page. */
export const STAGE = '#main [data-world-stage]';

/** Impact's switch between "Your impact" and "The planet now" (the page's first labelled group). */
const IMPACT_VIEWS = '#main [role="group"][aria-label]';

const nav = (id: string): string => `[data-tour="nav-${id}"]`;
const COACH_BUTTON = '[data-tour="nav-coach"] button';

/**
 * `wide` is the desktop shell. On a phone the tour's strip sits low on the screen, so there a
 * step points at the tab bar rather than at something in the page the strip might cover.
 */
export function stepView(step: TourStepId, pathname: string, wide: boolean): StepView {
  const path = normalizePath(pathname);
  const copy = TOUR_COPY[step];
  const away = copy.away ?? copy.here;
  switch (step) {
    case 'world':
      return path === ROUTES.today
        ? { copy: copy.here, anchors: [STAGE], ring: false }
        : { copy: away, anchors: [nav('today')], ring: true };
    case 'log':
      if (path === ROUTES.log) {
        return {
          copy: copy.here,
          anchors: ['#main [data-tour="say-it"]', '#main input[type="search"]'],
          ring: true,
        };
      }
      return {
        copy: away,
        // On Today the page's own main button is the nearest way in.
        anchors:
          wide && path === ROUTES.today
            ? [`#main a[href="${ROUTES.log}"]`, nav('log')]
            : [nav('log')],
        ring: true,
      };
    case 'impact':
      return path === ROUTES.impact
        ? { copy: copy.here, anchors: [IMPACT_VIEWS], ring: true }
        : { copy: away, anchors: [nav('impact'), nav('more')], ring: true };
    case 'coach':
      return path === ROUTES.coach
        ? { copy: copy.here, anchors: ['#main textarea'], ring: true }
        : { copy: away, anchors: [COACH_BUTTON, nav('more')], ring: true };
  }
}
