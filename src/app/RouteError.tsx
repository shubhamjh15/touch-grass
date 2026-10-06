'use client';

interface RouteErrorProps {
  error: Error;
  onRetry: () => void;
}

/** Last-resort screen when a route throws while rendering. */
export function RouteError({ error, onRetry }: RouteErrorProps) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="shadow-neo max-w-md rounded-xl border-4 border-ink bg-white p-6">
        <h1 className="text-2xl font-bold">That branch snapped.</h1>
        <p className="mt-2">{error.message || 'Something went wrong.'}</p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="bg-neo-green shadow-neo-sm cursor-pointer rounded-lg border-4 border-ink px-4 py-2 font-bold"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shadow-neo-sm cursor-pointer rounded-lg border-4 border-ink bg-white px-4 py-2 font-bold"
          >
            Reload
          </button>
        </div>
      </div>
    </main>
  );
}
