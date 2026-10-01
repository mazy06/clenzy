export type ResourceKind =
  | 'barometre'
  | 'calculateur'
  | 'obligations'
  | 'academie'
  | 'blog'
  | 'glossaire';

export interface RevenueInputs {
  properties: number;
  nights: number;
  occupancy: number;
  rate: number;
  commission: number;
  variableCost: number;
  fixedCost: number;
  extras: number;
}

export const DEFAULT_REVENUE_INPUTS: RevenueInputs = {
  properties: 1,
  nights: 30,
  occupancy: 65,
  rate: 850,
  commission: 15,
  variableCost: 110,
  fixedCost: 2500,
  extras: 0,
};

export const REVENUE_LIMITS: Record<keyof RevenueInputs, [number, number]> = {
  properties: [1, 500],
  nights: [1, 31],
  occupancy: [0, 100],
  rate: [0, 100000],
  commission: [0, 100],
  variableCost: [0, 100000],
  fixedCost: [0, 10000000],
  extras: [0, 100000],
};

/** A scenario, not a forecast. Costs and extras are per property; no tax assumption. */
export function calculateRevenue(input: RevenueInputs) {
  const values = Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const [min, max] = REVENUE_LIMITS[key as keyof RevenueInputs];
      return [
        key,
        Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)),
      ];
    }),
  ) as unknown as RevenueInputs;
  const properties = Math.floor(values.properties);
  const bookedNights = (Math.floor(values.nights) * values.occupancy) / 100;
  const accommodation = bookedNights * values.rate * properties;
  const extras = bookedNights * values.extras * properties;
  const fees = (accommodation * values.commission) / 100;
  const operatingCosts =
    (bookedNights * values.variableCost + values.fixedCost) * properties;
  const net = accommodation + extras - fees - operatingCosts;
  const contribution =
    values.rate * (1 - values.commission / 100) +
    values.extras -
    values.variableCost;
  const breakEven =
    contribution > 0
      ? (values.fixedCost / (Math.floor(values.nights) * contribution)) * 100
      : null;
  return {
    bookedNights,
    accommodation,
    extras,
    fees,
    operatingCosts,
    net,
    breakEven,
  };
}

export function normalizeResourceSearch(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .trim();
}

// Published 1 September 2026. Changes in classified-accommodation guest nights,
// January–June 2026 vs January–June 2025. Not short-term rental occupancy or ADR.
export const MARKET_SOURCE =
  'https://www.maroc.ma/fr/actualites/maroc-pres-de-94-millions-de-visiteurs-fin-juin';
export const MARKET_CITIES = [
  { id: 'marrakech', name: 'Marrakech', ar: 'مراكش', growth: 10 },
  { id: 'agadir', name: 'Agadir', ar: 'أكادير', growth: 11 },
  { id: 'casablanca', name: 'Casablanca', ar: 'الدار البيضاء', growth: 11 },
  { id: 'tanger', name: 'Tanger', ar: 'طنجة', growth: 10 },
  { id: 'rabat', name: 'Rabat', ar: 'الرباط', growth: 20 },
  { id: 'essaouira', name: 'Essaouira', ar: 'الصويرة', growth: 6 },
];
