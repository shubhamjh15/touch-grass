/**
 * @/app/shell — what pages may use from the app shell. Everything else under `src/app` is the
 * shell's own business.
 *
 * LAYOUT. A page renders no `<main>`, no navigation and no outer gutters: the shell wraps it.
 *   - `/today` (frame `bleed`) lays itself out edge to edge. The mobile app bar floats over
 *     the top 64 px of its stage; on desktop its content starts 112 px down (under the top bar).
 *   - Every other app route (frame `rail`) is placed in the content column: full width inside
 *     16 px gutters on a phone, columns 4 to 12 beside the grove rail at `lg` and up. Start
 *     the page with `<PageHeader>`: it renders the `h1` (which receives focus on navigation)
 *     and, on a phone, the 112 px grove sticker. Do not place another `WorldStage`.
 *   - `/learn/:lessonId` (frame `reading`) gets one centred column; pass `grove={false}`.
 *   - Bottom padding for the tab bar and the Log sticker is already applied below `lg`.
 *
 * FEEDBACK. The shell turns game events into toasts (with Undo), sounds, the XP bar's flash
 * and the level, badge and streak celebrations. A page calls `gameActions.*` and plays only
 * input sounds (`tap`, `toggle`, `tick`, and the `peel`/`stick` of its own flying sticker).
 * It never toasts for a game event; a log receipt uses the toast id `log-<logId>`.
 *
 * TITLES. Static titles come from each route file's `metadata`. Call `usePageTitle(text)`
 * only when the title depends on data.
 */
export {
  CUSTOM_LOG_LINK,
  PARAMS,
  ROUTES,
  TOUCH_GRASS_LINK,
  logLink,
  type LogLinkSource,
} from './routes';
export { takeAfterOnboardingDestination } from './guardDecision';
export { closeCoach, closePalette, openCoach, openPalette } from './shellStore';
export { PageHeader, type PageHeaderProps } from './page/PageHeader';
export { usePageTitle } from './page/usePageTitle';
export { useHideChrome } from './page/useHideChrome';
export { logToastId } from './feedback/eventFeedback';
