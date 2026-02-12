import apiClient from '../apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurfaceTier {
  maxSurface: number | null;
  coeff: number;
  label: string;
}

export interface PricingConfig {
  id: number | null;
  propertyTypeCoeffs: Record<string, number>;
  propertyCountCoeffs: Record<string, number>;
  guestCapacityCoeffs: Record<string, number>;
  frequencyCoeffs: Record<string, number>;
  surfaceTiers: SurfaceTier[];
  basePriceEssentiel: number;
  basePriceConfort: number;
  basePricePremium: number;
  minPrice: number;
  pmsMonthlyPriceCents: number;
  pmsSyncPriceCents: number;
  automationBasicSurcharge: number;
  automationFullSurcharge: number;
  updatedAt: string | null;
}

export type PricingConfigUpdate = Omit<PricingConfig, 'id' | 'updatedAt'>;

// ─── API ──────────────────────────────────────────────────────────────────────

export const pricingConfigApi = {
  get() {
    return apiClient.get<PricingConfig>('/pricing-config');
  },

  update(data: PricingConfigUpdate) {
    return apiClient.put<PricingConfig>('/pricing-config', data);
  },
};
