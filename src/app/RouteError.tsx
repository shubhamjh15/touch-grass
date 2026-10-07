'use client';

import { useOnlineStatus } from '@/lib/hooks';
import { ErrorState, TextLink, toastLater } from '@/ui';
import { Main } from './Main';
import { Logo } from './nav/Logo';
import { ROUTES } from './routes';

interface RouteErrorProps {
  error: Error & { digest?: string };
  onRetry: () => void;
}

/** A page's code could not be fetched: offline on a first visit, or a deploy replaced the chunk. */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /loading (css )?chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
      error.message,
    )
  );
}

/**
 * Hands the user their data as a file, so an error can never trap it. The code that does it
 * (and with it the game) is fetched on the tap: this boundary is part of every route, and must
 * not bring the engine to all of them.
 */
function exportData(): void {
  const failed = () =>
    toastLater({
      title: 'The export did not start.',
      meta: 'Try again from Me, under Data.',
      tone: 'danger',
    });
  import('./exportSave')
    .then(({ downloadSave }) => {
      downloadSave();
      toastLater({ title: 'Exported. The file is in your downloads.', tone: 'success' });
    })
    .catch(failed);
}

/**
 * The route error boundary (bible 4.7 and 6): calm, specific, and it always offers a way to
 * take the data out. A chunk that failed to load gets its own wording and a real reload.
 */
export function RouteError({ error, onRetry }: RouteErrorProps) {
  const online = useOnlineStatus();
  const chunk = isChunkLoadError(error);
  const details = [error.name, error.message, error.digest ? `digest ${error.digest}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Main className="grid min-h-dvh place-items-center py-10 px-gutter">
      <div className="grid w-full max-w-[520px] gap-5">
        <Logo href={ROUTES.landing} className="justify-self-start" />
        <ErrorState
          title={chunk ? 'This page did not load.' : undefined}
          body={
            chunk
              ? online
                ? 'An update is still arriving. Reloading usually fetches it.'
                : 'You are offline and this page is not saved on this device yet. Connect once and it will be.'
              : 'Something went wrong on this page. Trying again usually fixes it.'
          }
          onRetry={chunk ? () => window.location.reload() : onRetry}
          onExport={exportData}
          details={details || undefined}
        />
        <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm font-semibold">
          <TextLink href={ROUTES.today}>Back to the grove</TextLink>
          {chunk ? null : (
            <button
              type="button"
              className="cursor-pointer link"
              onClick={() => window.location.reload()}
            >
              Reload the app
            </button>
          )}
        </p>
      </div>
    </Main>
  );
}
