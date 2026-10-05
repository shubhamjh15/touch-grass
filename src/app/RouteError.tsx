import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Last-resort screen when a route fails to load or throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong.';

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-xl border-4 border-ink bg-white p-6 shadow-neo">
        <h1 className="text-2xl font-bold">That branch snapped.</h1>
        <p className="mt-2">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg border-4 border-ink bg-neo-green px-4 py-2 font-bold shadow-neo-sm"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
