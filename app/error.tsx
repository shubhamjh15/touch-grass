'use client';

import { RouteError } from '@/app/layouts/RootLayout';

/** Shown when a route throws while rendering. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteError error={error} onRetry={reset} />;
}
