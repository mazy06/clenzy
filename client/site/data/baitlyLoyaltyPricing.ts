import type { SiteLanguage } from '../lib/siteLanguage';

export type BaitlyPlan = 'essential' | 'pro';
export type BaitlyMarket = 'MA' | 'EU' | 'SA';

/** Proposed public loyalty schedule. This does not configure billing. */
export const BAITLY_LOYALTY_STAGES = [
  { start: 1, end: 3, discount: 0 },
  { start: 4, end: 6, discount: 10 },
  { start: 7, end: 12, discount: 20 },
  { start: 13, end: null, discount: 30 },
] as const;

/** Marginal bands: each rate applies only to properties inside that band. */
export const BAITLY_VOLUME_TIERS = [
  { start: 1, end: 4, discount: 0 },
  { start: 5, end: 9, discount: 10 },
  { start: 10, end: 19, discount: 15 },
  { start: 20, end: 49, discount: 20 },
] as const;

/** Fixed market prices, never live currency conversions. */
export const BAITLY_PRICING_MARKETS = {
  MA: { currency: 'MAD', essential: 290, pro: 490 },
  EU: { currency: 'EUR', essential: 29, pro: 49 },
  SA: { currency: 'SAR', essential: 109, pro: 189 },
} as const;
export const DEFAULT_PRICING_MARKET: Record<SiteLanguage, BaitlyMarket> = {
  fr: 'MA',
  en: 'EU',
  ar: 'SA',
};

export function loyaltyStage(month: number) {
  return BAITLY_LOYALTY_STAGES.findIndex(
    (stage) => stage.end === null || month <= stage.end,
  );
}

export function loyaltyUnitPrice(
  market: BaitlyMarket,
  plan: BaitlyPlan,
  month: number,
  properties = 1,
) {
  return loyaltyQuote(market, plan, month, properties).average;
}

export function loyaltyQuote(
  market: BaitlyMarket,
  plan: BaitlyPlan,
  month: number,
  properties: number,
) {
  if (!Number.isInteger(properties) || properties < 1 || properties > 49) {
    throw new RangeError('Baitly pricing simulation supports 1–49 properties.');
  }
  if (!Number.isInteger(month) || month < 1) {
    throw new RangeError(
      'Baitly pricing simulation requires a positive month.',
    );
  }
  const baseCents = Math.round(BAITLY_PRICING_MARKETS[market][plan] * 100);
  const bands = BAITLY_VOLUME_TIERS.map((tier) => {
    const count = Math.max(0, Math.min(properties, tier.end) - tier.start + 1);
    const unitCents = Math.round((baseCents * (100 - tier.discount)) / 100);
    return { ...tier, count, unitCents, totalCents: unitCents * count };
  });
  const volumeCents = bands.reduce((sum, band) => sum + band.totalCents, 0);
  const discount = BAITLY_LOYALTY_STAGES[loyaltyStage(month)].discount;
  // Apply tenure once to the volume subtotal, then round the monthly bill.
  const totalCents = Math.round((volumeCents * (100 - discount)) / 100);
  return {
    bands,
    baseTotal: (baseCents * properties) / 100,
    volumeTotal: volumeCents / 100,
    volumeSavings: (baseCents * properties - volumeCents) / 100,
    loyaltySavings: (volumeCents - totalCents) / 100,
    total: totalCents / 100,
    average: Math.round(totalCents / properties) / 100,
  };
}

export function loyaltyFirstYear(
  market: BaitlyMarket,
  plan: BaitlyPlan,
  properties: number,
) {
  const total =
    BAITLY_LOYALTY_STAGES.slice(0, 3).reduce(
      (sum, stage) =>
        sum +
        Math.round(
          loyaltyQuote(market, plan, stage.start, properties).total * 100,
        ) *
          ((stage.end ?? 12) - stage.start + 1),
      0,
    ) / 100;
  const reference = BAITLY_PRICING_MARKETS[market][plan] * 12 * properties;
  return {
    total,
    reference,
    savings: Math.round((reference - total) * 100) / 100,
  };
}

export function formatLoyaltyPrice(
  value: number,
  market: BaitlyMarket,
  language: SiteLanguage,
) {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: BAITLY_PRICING_MARKETS[market].currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
