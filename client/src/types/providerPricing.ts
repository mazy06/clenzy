/** Contrat du modèle PricingModel du backend, partagé par le site et le PMS. */
export const PROVIDER_PRICING_MODELS = ['FLAT', 'HOURLY', 'PER_SQM', 'PER_UNIT', 'ON_QUOTE'] as const;
export type ProviderPricingModel = typeof PROVIDER_PRICING_MODELS[number];
