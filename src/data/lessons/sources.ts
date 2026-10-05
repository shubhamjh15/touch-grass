/**
 * The registry of sources behind lessons, myth-busters, daily facts, editorial posts and the
 * bundled datasets, keyed so the methodology page can join them. Keys that the action
 * catalogue also uses (`desnz2026`, `ember2026`, `ipccAR6wg3`, `wynes2017`, `hotOrCool2021`,
 * `owidFoodLocal`, `ukEABags`, `appleIphone17`, `levis2015`, `gcb2025`) keep the same spelling, so
 * one key means one source across the whole app.
 */
import type { SourceRef } from './types';

type SourceInput = Omit<SourceRef, 'key'>;

const INPUT = {
  // Datasets
  nasaGistemp: {
    title: 'GISS Surface Temperature Analysis (GISTEMP v4), Land-Ocean Global Means',
    publisher: 'NASA Goddard Institute for Space Studies',
    url: 'https://data.giss.nasa.gov/gistemp/',
    year: 2026,
  },
  noaaMaunaLoa: {
    title: 'Trends in Atmospheric Carbon Dioxide: Mauna Loa annual mean',
    publisher: 'NOAA Global Monitoring Laboratory',
    url: 'https://gml.noaa.gov/ccgg/trends/',
    year: 2026,
  },
  gcb2025Owid: {
    title: 'Annual CO2 emissions (Global Carbon Budget 2025, processed by Our World in Data)',
    publisher: 'Global Carbon Project / Our World in Data',
    url: 'https://ourworldindata.org/grapher/annual-co2-emissions-per-country',
    year: 2025,
  },
  ember2026: {
    title: 'Yearly Electricity Data',
    publisher: 'Ember',
    url: 'https://ember-energy.org/data/yearly-electricity-data/',
    year: 2026,
  },
  irenaOwidSolarPrice: {
    title: 'Solar photovoltaic module price (IRENA, via Our World in Data)',
    publisher: 'IRENA / Our World in Data',
    url: 'https://ourworldindata.org/grapher/solar-pv-prices',
    year: 2025,
  },
  irenaOwidSolarCapacity: {
    title: 'Installed solar energy capacity (IRENA, via Our World in Data)',
    publisher: 'IRENA / Our World in Data',
    url: 'https://ourworldindata.org/grapher/installed-solar-pv-capacity',
    year: 2026,
  },
  ieaOwidEv: {
    title:
      'Share of new cars that are electric (IEA Global EV Outlook 2026, via Our World in Data)',
    publisher: 'IEA / Our World in Data',
    url: 'https://ourworldindata.org/grapher/electric-car-sales-share',
    year: 2026,
  },
  gcbOwidPerCapita: {
    title:
      'Per capita CO2 and greenhouse gas emissions (Global Carbon Budget 2025; Jones et al. 2025)',
    publisher: 'Global Carbon Project / Our World in Data',
    url: 'https://ourworldindata.org/grapher/consumption-co2-per-capita',
    year: 2025,
  },
  gcb2025: {
    title: 'Global Carbon Budget 2025. Earth System Science Data 18:3211-3288',
    publisher: 'Friedlingstein et al.',
    url: 'https://essd.copernicus.org/articles/18/3211/2026/',
    year: 2026,
  },
  gcb2024: {
    title: 'Global Carbon Budget 2024. Earth System Science Data 17:965-1039',
    publisher: 'Friedlingstein et al.',
    url: 'https://essd.copernicus.org/articles/17/965/2025/',
    year: 2025,
  },

  // Climate science
  ipccAR6wg1: {
    title: 'Climate Change 2021: The Physical Science Basis, Summary for Policymakers',
    publisher: 'IPCC Working Group I',
    url: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf',
    year: 2021,
  },
  ipccAR6wg1ch7: {
    title:
      'Climate Change 2021, Chapter 7: The Earth’s energy budget, climate feedbacks and climate sensitivity (Table 7.15)',
    publisher: 'IPCC Working Group I',
    url: 'https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/',
    year: 2021,
  },
  ipccAR6wg3: {
    title: 'Climate Change 2022: Mitigation of Climate Change, Summary for Policymakers',
    publisher: 'IPCC Working Group III',
    url: 'https://www.ipcc.ch/report/ar6/wg3/downloads/report/IPCC_AR6_WGIII_SummaryForPolicymakers.pdf',
    year: 2022,
  },
  ipccAr4Faq13: {
    title:
      'Climate Change 2007: The Physical Science Basis, FAQ 1.3: What is the greenhouse effect?',
    publisher: 'IPCC Working Group I',
    url: 'https://archive.ipcc.ch/publications_and_data/ar4/wg1/en/faq-1-3.html',
    year: 2007,
  },
  wmo2025: {
    title:
      '2025 set to be second or third warmest year on record, continuing exceptionally high warming trend',
    publisher: 'World Meteorological Organization',
    url: 'https://wmo.int/news/media-centre/2025-set-be-second-or-third-warmest-year-record-continuing-exceptionally-high-warming-trend',
    year: 2025,
  },
  unepEgr2025: {
    title: 'Emissions Gap Report 2025: Off target',
    publisher: 'UN Environment Programme',
    url: 'https://www.unep.org/resources/emissions-gap-report-2025',
    year: 2025,
  },
  owidSectors: {
    title: 'Emissions by sector: where do greenhouse gases come from?',
    publisher: 'Our World in Data',
    url: 'https://ourworldindata.org/emissions-by-sector',
    year: 2024,
  },
  noaaAcidification: {
    title: 'What is ocean acidification?',
    publisher: 'NOAA Pacific Marine Environmental Laboratory',
    url: 'https://www.pmel.noaa.gov/co2/story/What+is+Ocean+Acidification%3F',
    year: 2024,
  },
  wmoOzone2022: {
    title: 'Scientific Assessment of Ozone Depletion: 2022, Executive Summary',
    publisher: 'WMO / UNEP / NOAA / NASA / European Commission',
    url: 'https://csl.noaa.gov/assessments/ozone/2022/executivesummary/',
    year: 2022,
  },

  // Footprints, food, travel
  hotOrCool2021: {
    title: '1.5-Degree Lifestyles: Towards A Fair Consumption Space for All',
    publisher: 'Hot or Cool Institute',
    url: 'https://hotorcool.org/1-5-degree-lifestyles-report/',
    year: 2021,
  },
  oxfamSei2023: {
    title: 'Climate Equality: A planet for the 99%',
    publisher: 'Oxfam and Stockholm Environment Institute',
    url: 'https://www.oxfam.org/en/research/climate-equality-planet-99',
    year: 2023,
  },
  wynes2017: {
    title:
      'The climate mitigation gap: education and government recommendations miss the most effective individual actions. Environmental Research Letters 12:074024',
    publisher: 'Wynes and Nicholas',
    url: 'https://iopscience.iop.org/article/10.1088/1748-9326/aa7541',
    year: 2017,
  },
  pnFoodKg: {
    title:
      'Greenhouse gas emissions per kilogram of food product (Poore and Nemecek 2018, via Our World in Data)',
    publisher: 'Poore and Nemecek / Our World in Data',
    url: 'https://ourworldindata.org/grapher/ghg-per-kg-poore',
    year: 2018,
  },
  owidFoodLocal: {
    title:
      'You want to reduce the carbon footprint of your food? Focus on what you eat, not whether your food is local',
    publisher: 'Our World in Data',
    url: 'https://ourworldindata.org/food-choice-vs-eating-local',
    year: 2020,
  },
  owidLand: {
    title: 'Land use for agriculture: how much of the world’s land is used for food?',
    publisher: 'Our World in Data',
    url: 'https://ourworldindata.org/global-land-for-agriculture',
    year: 2024,
  },
  unepFwi2024: {
    title: 'Food Waste Index Report 2024: Think Eat Save',
    publisher: 'UN Environment Programme and WRAP',
    url: 'https://www.unep.org/resources/publication/food-waste-index-report-2024',
    year: 2024,
  },
  foodGovUk: {
    title: 'Best before and use by dates',
    publisher: 'UK Food Standards Agency',
    url: 'https://www.food.gov.uk/safety-hygiene/best-before-and-use-by-dates',
    year: 2025,
  },
  desnz2026: {
    title: 'UK Government GHG Conversion Factors for Company Reporting 2026',
    publisher: 'UK Department for Energy Security and Net Zero',
    url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
    year: 2026,
  },
  owidAviation: {
    title: 'What share of global CO2 emissions come from aviation?',
    publisher: 'Our World in Data',
    url: 'https://ourworldindata.org/co2-emissions-from-aviation',
    year: 2024,
  },
  kloewer2021: {
    title:
      'Quantifying aviation’s contribution to global warming. Environmental Research Letters 16:104027',
    publisher: 'Klöwer et al.',
    url: 'https://doi.org/10.1088/1748-9326/ac286e',
    year: 2021,
  },
  icct2025: {
    title:
      'Life-cycle greenhouse gas emissions of combustion engine and electric cars in Europe, 2025 update',
    publisher: 'International Council on Clean Transportation',
    url: 'https://theicct.org/publication/electric-cars-life-cycle-analysis-emissions-europe-jul25/',
    year: 2025,
  },
  doeTrips: {
    title: 'FOTW #1230: More than half of all daily trips were less than three miles in 2021',
    publisher: 'US Department of Energy',
    url: 'https://www.energy.gov/node/4818390',
    year: 2022,
  },

  // Home energy
  eurostatHouseholds2022: {
    title: 'Energy use in EU households in 2022 lowest since 2016',
    publisher: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat/de/web/products-eurostat-news/w/ddn-20240605-2',
    year: 2024,
  },
  energyStarWashers: {
    title: 'Clothes washers',
    publisher: 'ENERGY STAR',
    url: 'https://www.energystar.gov/products/clothes_washers',
    year: 2025,
  },
  lblStandby: {
    title: 'Standby power',
    publisher: 'Lawrence Berkeley National Laboratory',
    url: 'https://standby.lbl.gov/',
    year: 2025,
  },
  doeLed: {
    title: 'LED Lighting',
    publisher: 'US Department of Energy',
    url: 'https://www.energy.gov/energysaver/led-lighting',
    year: 2024,
  },
  ieaPlayingMyPart: {
    title:
      'Playing my part: how to save money, reduce reliance on Russian energy and support Ukraine',
    publisher: 'IEA and European Commission',
    url: 'https://www.iea.org/reports/playing-my-part',
    year: 2022,
  },
  ieaHeatPumps: {
    title: 'The Future of Heat Pumps: how a heat pump works',
    publisher: 'IEA',
    url: 'https://www.iea.org/reports/the-future-of-heat-pumps/how-a-heat-pump-works',
    year: 2022,
  },
  ieaStreaming: {
    title: 'The carbon footprint of streaming video: fact-checking the headlines',
    publisher: 'IEA',
    url: 'https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines',
    year: 2020,
  },

  // Stuff and waste
  appleIphone17: {
    title: 'iPhone 17 Product Environmental Report',
    publisher: 'Apple',
    url: 'https://www.apple.com/environment/pdf/products/iphone/iPhone_17_PER_Sept2025.pdf',
    year: 2025,
  },
  levis2015: {
    title:
      'The Life Cycle of a Jean: Understanding the environmental impact of a pair of Levi’s 501 jeans',
    publisher: 'Levi Strauss & Co.',
    url: 'https://www.levistrauss.com/wp-content/uploads/2015/03/Full-LCA-Results-Deck-FINAL.pdf',
    year: 2015,
  },
  ewaste2024: {
    title: 'Global E-waste Monitor 2024',
    publisher: 'UNITAR and ITU',
    url: 'https://www.unitar.org/about/news-stories/press/global-e-waste-monitor-2024-electronic-waste-rising-five-times-faster-documented-e-waste-recycling',
    year: 2024,
  },
  ellenMacArthur: {
    title: 'What is a circular economy?',
    publisher: 'Ellen MacArthur Foundation',
    url: 'https://www.ellenmacarthurfoundation.org/topics/circular-economy-introduction/overview',
    year: 2024,
  },
  oecdPlastics2022: {
    title:
      'Global Plastics Outlook: plastic pollution is growing relentlessly as waste management and recycling fall short',
    publisher: 'OECD',
    url: 'https://www.oecd.org/en/about/news/press-releases/2022/02/plastic-pollution-is-growing-relentlessly-as-waste-management-and-recycling-fall-short.html',
    year: 2022,
  },
  iaiRecycling: {
    title: 'Aluminium recycling saves 95% of the energy needed for primary aluminium production',
    publisher: 'International Aluminium Institute',
    url: 'https://international-aluminium.org/landing/aluminium-recycling-saves-95-of-the-energy-needed-for-primary-aluminium-production/',
    year: 2024,
  },
  epaBatteries: {
    title: 'Used lithium-ion batteries',
    publisher: 'US Environmental Protection Agency',
    url: 'https://www.epa.gov/recycle/used-lithium-ion-batteries',
    year: 2025,
  },
  warmOrganics: {
    title: 'Documentation for the Waste Reduction Model (WARM) v16: Organic Materials',
    publisher: 'US Environmental Protection Agency',
    url: 'https://www.epa.gov/system/files/documents/2023-12/warm_organic_materials_v16_dec.pdf',
    year: 2023,
  },
  ukEABags: {
    title:
      'Life cycle assessment of supermarket carrier bags: a review of the bags available in 2006',
    publisher: 'UK Environment Agency',
    url: 'https://www.gov.uk/government/publications/life-cycle-assessment-of-supermarket-carrierbags-a-review-of-the-bags-available-in-2006',
    year: 2011,
  },

  doeTree1998: {
    title: 'Method for Calculating Carbon Sequestration by Trees in Urban and Suburban Settings',
    publisher: 'US Department of Energy and US EPA',
    url: 'https://www3.epa.gov/climatechange/Downloads/method-calculating-carbon-sequestration-trees-urban-and-suburban-settings.pdf',
    year: 1998,
  },

  // Progress and people
  irenaCosts2024: {
    title: 'Renewable Power Generation Costs in 2024',
    publisher: 'IRENA',
    url: 'https://www.irena.org/Publications/2025/Jun/Renewable-Power-Generation-Costs-in-2024',
    year: 2025,
  },
  andre2024: {
    title:
      'Globally representative evidence on the actual and perceived support for climate action. Nature Climate Change 14:253-259',
    publisher: 'Andre, Boneva, Chopra and Falk',
    url: 'https://doi.org/10.1038/s41558-023-01925-3',
    year: 2024,
  },
  white2019: {
    title:
      'Spending at least 120 minutes a week in nature is associated with good health and wellbeing. Scientific Reports 9:7730',
    publisher: 'White et al.',
    url: 'https://doi.org/10.1038/s41598-019-44097-3',
    year: 2019,
  },
} as const satisfies Record<string, SourceInput>;

export type ContentSourceKey = keyof typeof INPUT;

/** Every content source by key. */
export const CONTENT_SOURCES: Readonly<Record<ContentSourceKey, SourceRef>> = Object.fromEntries(
  Object.entries(INPUT).map(([key, source]) => [key, { key, ...source }]),
) as Record<ContentSourceKey, SourceRef>;

/** Builds the sources list of one content item from keys, in the order given. */
export function sourcesFor(...keys: readonly ContentSourceKey[]): readonly SourceRef[] {
  return keys.map((key) => CONTENT_SOURCES[key]);
}
