/**
 * The app's region ids against the World Bank's three-letter codes. Countries carry our own
 * plain name; a grouping takes the World Bank's name, because its borders are the bank's and
 * not ours ("Europe & Central Asia" is not "Europe"). Asia and Oceania have no single World Bank
 * aggregate, so they are left out rather than approximated.
 */
export interface ClimateRegion {
  id: string;
  iso3: string;
  /** `null`: print the name the World Bank returns. */
  name: string | null;
}

export const WORLD_ISO3 = 'WLD';

export const CLIMATE_REGIONS: readonly ClimateRegion[] = [
  { id: 'IN', iso3: 'IND', name: 'India' },
  { id: 'US', iso3: 'USA', name: 'United States' },
  { id: 'EU27', iso3: 'EUU', name: 'European Union' },
  { id: 'GB', iso3: 'GBR', name: 'United Kingdom' },
  { id: 'CN', iso3: 'CHN', name: 'China' },
  { id: 'CA', iso3: 'CAN', name: 'Canada' },
  { id: 'AU', iso3: 'AUS', name: 'Australia' },
  { id: 'BR', iso3: 'BRA', name: 'Brazil' },
  { id: 'DE', iso3: 'DEU', name: 'Germany' },
  { id: 'FR', iso3: 'FRA', name: 'France' },
  { id: 'JP', iso3: 'JPN', name: 'Japan' },
  { id: 'ZA', iso3: 'ZAF', name: 'South Africa' },
  { id: 'ID', iso3: 'IDN', name: 'Indonesia' },
  { id: 'MX', iso3: 'MEX', name: 'Mexico' },
  { id: 'KR', iso3: 'KOR', name: 'South Korea' },
  { id: 'IT', iso3: 'ITA', name: 'Italy' },
  { id: 'ES', iso3: 'ESP', name: 'Spain' },
  { id: 'NL', iso3: 'NLD', name: 'Netherlands' },
  { id: 'PL', iso3: 'POL', name: 'Poland' },
  { id: 'SE', iso3: 'SWE', name: 'Sweden' },
  { id: 'NO', iso3: 'NOR', name: 'Norway' },
  { id: 'TR', iso3: 'TUR', name: 'Türkiye' },
  { id: 'RU', iso3: 'RUS', name: 'Russia' },
  { id: 'SA', iso3: 'SAU', name: 'Saudi Arabia' },
  { id: 'AE', iso3: 'ARE', name: 'United Arab Emirates' },
  { id: 'EG', iso3: 'EGY', name: 'Egypt' },
  { id: 'NG', iso3: 'NGA', name: 'Nigeria' },
  { id: 'KE', iso3: 'KEN', name: 'Kenya' },
  { id: 'PK', iso3: 'PAK', name: 'Pakistan' },
  { id: 'BD', iso3: 'BGD', name: 'Bangladesh' },
  { id: 'VN', iso3: 'VNM', name: 'Vietnam' },
  { id: 'PH', iso3: 'PHL', name: 'Philippines' },
  { id: 'TH', iso3: 'THA', name: 'Thailand' },
  { id: 'MY', iso3: 'MYS', name: 'Malaysia' },
  { id: 'SG', iso3: 'SGP', name: 'Singapore' },
  { id: 'AR', iso3: 'ARG', name: 'Argentina' },
  { id: 'NZ', iso3: 'NZL', name: 'New Zealand' },
  { id: 'NAMERICA', iso3: 'NAC', name: null },
  { id: 'LATAM', iso3: 'LCN', name: null },
  { id: 'EUROPE', iso3: 'ECS', name: null },
  { id: 'AFRICA', iso3: 'SSF', name: null },
  { id: 'MIDEAST', iso3: 'MEA', name: null },
];
