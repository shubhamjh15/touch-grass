#!/usr/bin/env node
/**
 * Writes the generated modules of src/data/catalogue from two inputs, so that no
 * factor, cap or preset is ever typed by hand:
 *
 *   1. the evidence base (emissions.json: factors, ranges, grid intensity, the
 *      baseline model, equivalences and the source registry), and
 *   2. the product overlay (scripts/catalogue/overlay.mjs: category, XP rule,
 *      overlap groups, cadence, counterfactual copy).
 *
 *   node scripts/build-catalogue.mjs [path/to/emissions.json] [--check]
 *
 * The evidence file defaults to .redesign/research/emissions.json (the research
 * workspace); pass a path or set ECOQUEST_EVIDENCE to build from another copy.
 * `--check` writes nothing and exits 1 when a generated file is out of date.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { DEFAULT_VARIANTS, GROUPS, NOTES, OVERLAY } from './catalogue/overlay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'src', 'data', 'catalogue');
const args = process.argv.slice(2);
const check = args.includes('--check');
const evidencePath = path.resolve(
  args.find((arg) => !arg.startsWith('--')) ??
    process.env.ECOQUEST_EVIDENCE ??
    path.join(root, '.redesign', 'research', 'emissions.json'),
);
if (!existsSync(evidencePath)) {
  console.error(`Evidence base not found: ${evidencePath}`);
  process.exit(2);
}
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
if (evidence.meta.schemaVersion !== 1) {
  throw new Error(`Unsupported evidence schema ${evidence.meta.schemaVersion}`);
}

function fail(message) {
  throw new Error(`build-catalogue: ${message}`);
}
function expectEqual(actual, expected, what) {
  if (actual !== expected) fail(`${what}: expected ${expected}, the evidence base gives ${actual}`);
}
const round = (value, decimals) => Number(value.toFixed(decimals));
const refs = (sources) => (sources ?? []).map((source) => source.ref);

// ── Actions ─────────────────────────────────────────────────────────────────
const EVIDENCE_ACTIONS = new Map(evidence.actions.map((action) => [action.id, action]));
const DECIMALS_BY_UNIT = { km: 1, minute: 1, hour: 1, litre: 2, kg: 2 };
const CATEGORY_COUNTS = { move: 10, eat: 9, power: 5, water: 5, stuff: 6, waste: 9, nature: 7 };

for (const id of EVIDENCE_ACTIONS.keys()) {
  if (!OVERLAY.some((row) => row.id === id))
    fail(`the overlay has no row for evidence action ${id}`);
}

const actions = OVERLAY.map((row) => {
  const source = EVIDENCE_ACTIONS.get(row.id);
  if (!row.xpOnly && !source) fail(`no evidence for ${row.id}`);
  if (row.xpOnly && source) fail(`${row.id} is marked xpOnly but has evidence`);
  const unit = row.unit ?? source.unit;
  const presets = row.presets ?? source.ux.presets;
  const dailyCap = row.cap ?? source.ux.suggestedDailyCap;
  if (!presets.includes(row.def)) fail(`${row.id}: default ${row.def} is not a preset`);
  if (presets.some((preset) => preset > dailyCap)) fail(`${row.id}: a preset exceeds the cap`);
  if (row.group && !GROUPS[row.group]) fail(`${row.id}: unknown group ${row.group}`);
  const quantified = Boolean(source) && source.kgCO2ePerUnit != null;
  const variants = (source?.variants ?? [])
    .filter((variant) => variant.label)
    .map((variant) => ({
      id: variant.id,
      label: variant.label,
      kgPerUnit: variant.kgCO2ePerUnit,
      basis: variant.basis ?? null,
    }));
  const defaultVariant = DEFAULT_VARIANTS[row.id] ?? null;
  if (defaultVariant && !variants.some((variant) => variant.id === defaultVariant)) {
    fail(`${row.id}: default variant ${defaultVariant} is not in the evidence base`);
  }
  if (variants.length > 0 && !defaultVariant) fail(`${row.id}: variants need a default`);
  return {
    id: row.id,
    category: row.cat,
    emoji: row.emoji,
    title: row.title,
    unit,
    unitLabel: source?.unitLabel ?? unit,
    presets,
    defaultQty: row.def,
    dailyCap,
    decimals: DECIMALS_BY_UNIT[unit] ?? 0,
    xp: row.xp,
    acts: row.acts,
    maxActs: row.maxActs,
    group: row.group ?? null,
    cadence: row.cadence,
    credit: !quantified ? 'none' : (row.credit ?? 'log'),
    counterfactual: row.cf,
    counterfactualDetail: source?.counterfactual ?? null,
    confidence: source?.confidence ?? 'not_quantified',
    factor: quantified
      ? {
          central: source.kgCO2ePerUnit,
          low: source.low,
          high: source.high,
          kWhPerUnit: source.kWhPerUnit,
          nonGridKgPerUnit: source.nonGridKgCO2ePerUnit,
          heatKWhPerUnit: source.heatKWhPerUnit,
          regionalisation: source.regionalisation,
        }
      : null,
    perHousehold: source?.perHousehold ?? false,
    formula: source?.formula ?? null,
    evidenceNotes: source?.notes ?? null,
    sheetNote: NOTES[row.id] ?? null,
    variants,
    defaultVariant,
    sources: refs(source?.sources),
  };
});

expectEqual(actions.length, 51, 'catalogue size');
expectEqual(new Set(actions.map((action) => action.id)).size, 51, 'unique action ids');
for (const [category, count] of Object.entries(CATEGORY_COUNTS)) {
  expectEqual(
    actions.filter((action) => action.category === category).length,
    count,
    `${category} actions`,
  );
}
expectEqual(actions.filter((action) => action.factor).length, 41, 'quantified actions');
expectEqual(
  actions.filter((action) => action.credit === 'context').length,
  1,
  'context-only actions',
);

const groups = Object.entries(GROUPS).map(([id, group]) => ({
  id,
  label: group.label,
  maxActs: group.maxActs,
  hint: group.hint ?? null,
  unitCap: group.unitCap ?? null,
  actions: actions.filter((action) => action.group === id).map((action) => action.id),
}));

// ── Grid ────────────────────────────────────────────────────────────────────
const grid = evidence.grid.map((region) => ({
  id: region.id,
  name: region.name,
  type: region.type,
  primary: region.primary,
  year: region.year,
  kgCO2ePerKWh: region.kgCO2ePerKWh,
  renewablesSharePct: region.renewablesSharePct,
  cleanSharePct: region.cleanSharePct,
}));
expectEqual(grid.length, 45, 'grid regions');
expectEqual(grid[0].id, evidence.meta.defaultGrid.id, 'first grid region');
expectEqual(grid[0].kgCO2ePerKWh, evidence.meta.defaultGrid.kgCO2ePerKWh, 'world grid intensity');

// ── Reference factors behind the regional computation (spec section 3.5) ────
const transport = evidence.referenceFactors.transport;
const energy = evidence.referenceFactors.energy;
const reference = {
  carKgPerKm: {
    default: transport.GB.perVehicleKm.carAverage,
    byRegion: {
      US: transport.US.perVehicleKm.averageGasolineVehicle_carsAndLightTrucks,
      IN: transport.IN.perVehicleKm.hatchbackUnder1400ccPetrol,
    },
  },
  busKgPerPassengerKm: {
    default: transport.GB.perPassengerKm.busAverageLocal,
    byRegion: {
      US: transport.US.perPassengerKm.bus,
      IN: round(transport.IN.perPassengerKm.cityBus, 4),
    },
  },
  railKgPerPassengerKm: {
    default: transport.GB.perPassengerKm.railNational,
    byRegion: {
      US: transport.US.perPassengerKm.commuterRail,
      IN: round(transport.IN.perPassengerKm.railNonSuburban_2014_15, 4),
    },
  },
  petrolCarKgPerKm: transport.GB.perVehicleKm.carPetrol,
  electricCarKWhPerKm: transport.GB.perVehicleKm.carBatteryElectric_kWhPerKm,
  gasKgPerKWh: energy.naturalGas_kgCO2ePerKWh.total,
  boilerEfficiency: energy.assumptions.boilerEfficiency,
  heatPumpCop: energy.assumptions.heatPumpCOP,
  homeworkingKgPerHour: {
    heatingOrCooling: round(energy.homeworking_kgCO2ePerHour.total, 3),
    equipmentOnly: round(energy.homeworking_kgCO2ePerHour.equipment, 3),
  },
  homeworkingHours: 8,
  waterSupplyKgPerLitre: round(evidence.referenceFactors.water.total_kgCO2ePerLitre, 5),
  ledKWhPerBulbYear: round(EVIDENCE_ACTIONS.get('led-bulb-swap').kWhPerUnit * 365, 0),
  tapOffLitresPerDay: 30,
};
// The spec quotes these constants; a changed evidence base must be noticed here, not in a test run.
expectEqual(reference.carKgPerKm.default, 0.2099, 'average car');
expectEqual(reference.carKgPerKm.byRegion.US, 0.2442, 'US car');
expectEqual(reference.carKgPerKm.byRegion.IN, 0.14, 'India car');
expectEqual(reference.busKgPerPassengerKm.default, 0.128, 'bus');
expectEqual(reference.busKgPerPassengerKm.byRegion.US, 0.041, 'US bus');
expectEqual(reference.busKgPerPassengerKm.byRegion.IN, 0.0152, 'India bus');
expectEqual(reference.railKgPerPassengerKm.default, 0.0399, 'rail');
expectEqual(reference.railKgPerPassengerKm.byRegion.US, 0.0826, 'US rail');
expectEqual(reference.railKgPerPassengerKm.byRegion.IN, 0.0078, 'India rail');
expectEqual(reference.petrolCarKgPerKm, 0.2075, 'petrol car');
expectEqual(reference.electricCarKWhPerKm, 0.20358, 'electric car kWh');
expectEqual(reference.gasKgPerKWh, 0.21252, 'gas factor');
expectEqual(reference.homeworkingKgPerHour.heatingOrCooling, 0.324, 'homeworking, heated');
expectEqual(reference.homeworkingKgPerHour.equipmentOnly, 0.022, 'homeworking, equipment');
expectEqual(reference.waterSupplyKgPerLitre, 0.00036, 'water supply');
expectEqual(reference.ledKWhPerBulbYear, 26, 'LED kWh per year');

const versionOf = (isoDate) => `${isoDate.slice(0, 4)}.${isoDate.slice(5, 7)}`;
const meta = {
  factorsVersion: versionOf(evidence.meta.generated),
  generated: evidence.meta.generated,
  dataRetrieved: evidence.meta.dataRetrieved,
  schemaVersion: evidence.meta.schemaVersion,
  defaultRegion: evidence.meta.defaultGrid.id,
};

// ── Baseline quiz model, verbatim ───────────────────────────────────────────
const model = evidence.baselineModel;
expectEqual(model.version, 1, 'baseline model version');
const questions = model.questions.map((question) => ({
  id: question.id,
  segment: question.category,
  prompt: question.prompt,
  options: question.options.map((option) => {
    const out = { id: option.id, label: option.label, note: option.note ?? null };
    if (option.tCO2ePerYear != null) out.tCO2ePerYear = option.tCO2ePerYear;
    if (option.kgCO2ePerKm != null) out.kgCO2ePerKm = option.kgCO2ePerKm;
    if (option.kWhPerKm != null) out.kWhPerKm = option.kWhPerKm;
    if (option.gridScaled) out.gridScaled = true;
    if (option.regional) out.regional = option.regional;
    if (option.kmPerWeek != null) out.kmPerWeek = option.kmPerWeek;
    if (option.electricityKWhPerPersonYear != null)
      out.electricityKWh = option.electricityKWhPerPersonYear;
    if (option.gasKWhPerPersonYear != null) out.gasKWh = option.gasKWhPerPersonYear;
    return out;
  }),
  uncertainty: question.uncertainty,
  sources: refs(question.sources),
}));
expectEqual(
  questions.map((question) => question.id).join(','),
  'diet,transportMode,weeklyDistance,flights,homeEnergy,shopping',
  'baseline questions',
);
const workedExamples = model.workedExamples.map((example) => ({
  region: example.region,
  answers: {
    diet: example.answers.diet,
    transportMode: example.answers.mode,
    weeklyDistance: example.answers.km,
    flights: example.answers.flights,
    homeEnergy: example.answers.home,
    shopping: example.answers.shop,
  },
  result: example.result,
}));
const lifestyle = evidence.targets.lifestyleFootprint;
const baseline = {
  version: model.version,
  what: model.what,
  formula: model.formula,
  gasKgPerKWh: model.constants.gasKgCO2ePerKWh,
  weeksPerYear: model.constants.weeksPerYear,
  uncertainty: model.uncertainty.overall,
  uncertaintyBySegment: model.uncertainty.byCategory,
  notAsked: model.notAsked,
  target2030: {
    tonnes: lifestyle.y2030,
    range: lifestyle.ranges['2030'],
    sources: refs(lifestyle.sources),
  },
  dailyBudgetKg2030: lifestyle.dailyBudgetKg.y2030,
  lifestyleFootprints2019: evidence.targets.currentAverages.lifestyleFootprints2019,
};
expectEqual(baseline.gasKgPerKWh, reference.gasKgPerKWh, 'baseline gas factor');

// ── Equivalences: only the ones the product ships (spec section 3.7) ────────
const SHIPPED_EQUIVALENCES = [
  'car-km',
  'flight-km',
  'smartphone-charges',
  'kettle-boils',
  'hot-shower-minutes',
  'beef-grams',
  'daily-1p5-budget',
  'world-average-person-day',
];
const equivalences = SHIPPED_EQUIVALENCES.map((id) => {
  const item = evidence.equivalences.find((entry) => entry.id === id);
  if (!item) fail(`equivalence ${id} is not in the evidence base`);
  return {
    id,
    label: item.label,
    kgCO2ePerUnit: item.kgCO2ePerUnit,
    kWhPerUnit: item.kWhPerUnit ?? null,
    gridScaled: Boolean(item.gridScaled),
    formula: item.formula,
    notes: item.notes ?? null,
    sources: refs(item.sources),
  };
});

// ── Sources ─────────────────────────────────────────────────────────────────
const sources = Object.fromEntries(
  Object.entries(evidence.sources).map(([key, source]) => [
    key,
    {
      title: source.title,
      publisher: source.publisher ?? null,
      url: source.url,
      year: source.year,
      evidence: source.evidence,
    },
  ]),
);
const cited = new Set([
  ...actions.flatMap((action) => action.sources),
  ...questions.flatMap((question) => question.sources),
  ...equivalences.flatMap((item) => item.sources),
  ...baseline.target2030.sources,
]);
for (const key of cited) if (!sources[key]) fail(`source ${key} is cited but not registered`);

// ── Emit ────────────────────────────────────────────────────────────────────
const banner = [
  '// GENERATED by scripts/build-catalogue.mjs from the evidence base and the product overlay.',
  '// Do not edit by hand: change the inputs and run the script again.',
  '',
].join('\n');
const literal = (value) => JSON.stringify(value, null, 2);
const idUnion = (ids) => `[${ids.map((id) => JSON.stringify(id)).join(', ')}] as const`;

const files = {
  'actions.ts': `${banner}
import type { ActionDef } from './types';

/** Every catalogue action id, in catalogue order. */
export const ACTION_IDS = ${idUnion(actions.map((action) => action.id))};
export type CatalogueActionId = (typeof ACTION_IDS)[number];

/** The 51 actions of the catalogue: 43 from the evidence base and 8 that earn XP only. */
export const ACTIONS: readonly (ActionDef & { id: CatalogueActionId })[] = ${literal(actions)};
`,
  'groups.ts': `${banner}
import type { GroupDef } from './types';

export const GROUP_IDS = ${idUnion(groups.map((group) => group.id))};
export type GroupId = (typeof GROUP_IDS)[number];

/** Overlap groups: actions that describe the same real-world thing share a daily cap. */
export const GROUPS: readonly (GroupDef & { id: GroupId })[] = ${literal(groups)};
`,
  'grid.ts': `${banner}
import type { GridRegion } from './types';

export const REGION_IDS = ${idUnion(grid.map((region) => region.id))};
export type RegionId = (typeof REGION_IDS)[number];

export const DEFAULT_REGION: RegionId = ${JSON.stringify(meta.defaultRegion)};

/** Lifecycle carbon intensity of electricity, per kWh generated (Ember, ${grid[0].year}). */
export const GRID: readonly (GridRegion & { id: RegionId })[] = ${literal(grid)};
`,
  'factors.ts': `${banner}
/** Versions and dates of the evidence base these modules were built from. */
export const EVIDENCE_META = ${literal(meta)} as const;

/** Building blocks of the regional computation: vehicles, heat, home working, water. */
export const REFERENCE_FACTORS = ${literal(reference)} as const;
`,
  'baseline.ts': `${banner}
import type { BaselineQuestion, BaselineWorkedExample } from './types';

/** The six questions of the starting-line quiz, verbatim from the evidence base. */
export const BASELINE_QUESTIONS: readonly BaselineQuestion[] = ${literal(questions)};

export const BASELINE_MODEL = ${literal(baseline)} as const;

/** Regression examples published with the model; the engine's tests reproduce them. */
export const BASELINE_WORKED_EXAMPLES: readonly BaselineWorkedExample[] = ${literal(workedExamples)};
`,
  'equivalences.ts': `${banner}
import type { EquivalenceDef } from './types';

export const EQUIVALENCE_IDS = ${idUnion(equivalences.map((item) => item.id))};
export type EquivalenceId = (typeof EQUIVALENCE_IDS)[number];

/** Comparisons that make a mass of CO2e imaginable. Always phrased as "roughly the CO2 from". */
export const EQUIVALENCES: readonly (EquivalenceDef & { id: EquivalenceId })[] = ${literal(equivalences)};
`,
  'sources.ts': `${banner}
import type { SourceDef } from './types';

/** Every source the catalogue, the baseline model and the equivalences cite, by key. */
export const SOURCES: Readonly<Record<string, SourceDef>> = ${literal(sources)};
`,
};

const config = (await prettier.resolveConfig(path.join(outDir, 'actions.ts'))) ?? {};
let stale = 0;
for (const [name, code] of Object.entries(files)) {
  const file = path.join(outDir, name);
  const formatted = await prettier.format(code, { ...config, parser: 'typescript' });
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === formatted) continue;
  stale += 1;
  if (check) console.log(`out of date: src/data/catalogue/${name}`);
  else {
    writeFileSync(file, formatted);
    console.log(`wrote src/data/catalogue/${name}`);
  }
}
console.log(
  `${actions.length} actions, ${groups.length} groups, ${grid.length} grid regions, ${equivalences.length} equivalences, ${Object.keys(sources).length} sources (factors ${meta.factorsVersion})`,
);
process.exit(check && stale > 0 ? 1 : 0);
