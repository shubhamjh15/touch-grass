'use client';

import { lazy } from 'react';

/**
 * The only doors into the Recharts chunk. Everything else on the page renders without the
 * library; a plot appears when its chunk lands, and a failed chunk falls back to the table.
 */
export const LazyLineSeriesChart = lazy(() =>
  import('../charts/LineSeriesChart').then((module) => ({ default: module.LineSeriesChart })),
);

export const LazyHBarChart = lazy(() =>
  import('../charts/HBarChart').then((module) => ({ default: module.HBarChart })),
);
