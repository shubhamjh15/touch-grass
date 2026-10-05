/**
 * Shapes of the bundled public datasets behind the /impact global charts. Data only: every
 * series in the generated modules of this folder is copied by `scripts/build-content-datasets.mjs`
 * from the research files, never typed by hand. This file is written by hand.
 */

export interface DatasetMeta {
  id: string;
  title: string;
  /** What one value means, e.g. "ppm (micromol CO2 per mol dry air)". */
  unit: string;
  /** Who published the numbers. */
  source: string;
  /** The citation line to print under a chart. */
  citation: string;
  /** Where the raw file was fetched from. */
  url: string;
  /** A human-readable page about the dataset. */
  landingPage: string | null;
  /** ISO date the file was retrieved. Every chart says "Bundled data · not live" next to it. */
  retrieved: string;
  /** Key into `CONTENT_SOURCES` so the methodology page can join it with the other sources. */
  sourceKey: string;
  /** The one honest sentence a chart caption can lead with. Numbers in it come from the series. */
  takeaway: string;
  /** Caveats that must travel with the data (baselines, what is excluded). */
  notes: readonly string[];
  /** Progress rather than a problem: lets the page choose a hopeful accent. */
  hopeful: boolean;
  /** Decimals worth showing for a value. */
  decimals: number;
}

export interface SeriesPoint {
  year: number;
  value: number;
}

/** One value per year. Years are strictly increasing. */
export interface SeriesDataset extends DatasetMeta {
  kind: 'series';
  series: readonly SeriesPoint[];
  /** Extra named series on the same axis (for example EV share by region). */
  comparisons: readonly { id: string; label: string; series: readonly SeriesPoint[] }[];
}

export interface MultiField {
  key: string;
  label: string;
  /** Percent shares and TWh cannot share one axis: charts group by `unit`. */
  unit: string;
}

export interface MultiPoint {
  year: number;
  [field: string]: number;
}

/** Several values per year, for example shares of electricity from different sources. */
export interface MultiSeriesDataset extends DatasetMeta {
  kind: 'multi';
  fields: readonly MultiField[];
  series: readonly MultiPoint[];
}

export interface SnapshotValue {
  year: number;
  value: number;
}

export interface SnapshotRow {
  id: string;
  name: string;
  /** What the app shows as the average person in this region. */
  best: number;
  bestBasis: 'consumption' | 'territorial';
  bestYear: number;
  consumptionCO2: SnapshotValue | null;
  territorialCO2: SnapshotValue | null;
  ghgInclLandUse: SnapshotValue | null;
}

/** One latest value per region, for a bar chart rather than a line. */
export interface SnapshotDataset extends DatasetMeta {
  kind: 'snapshot';
  rows: readonly SnapshotRow[];
}

export type Dataset = SeriesDataset | MultiSeriesDataset | SnapshotDataset;
