import apiClient from '../apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurfaceTier {
  maxSurface: number | null;
  coeff: number;
  label: string;
}

export interface SurfaceBasePrice {
  maxSurface: number | null;
  base: number;
}

export interface ForfaitConfig {
  key: string;                        // "CLEANING", "EXPRESS_CLEANING", "DEEP_CLEANING"
  label: string;                      // "Standard", "Express", "En profondeur"
  coeffMin: number;
  coeffMax: number;
  serviceTypes: string[];             // intervention types associated
  includedPrestations: string[];      // prestations included in base price
  extraPrestations: string[];         // prestations billed as extras
  eligibleTeamIds: number[];          // eligible teams (empty = all)
  surcharges: Record<string, number>; // perBedroom, perBathroom, etc.
  surfaceBasePrices: SurfaceBasePrice[];
}

export interface ServicePriceConfig {
  interventionType: string;           // ex: "ELECTRICAL_REPAIR"
  basePrice: number;                  // prix fixe de base en €
  enabled: boolean;
}

export interface BlanchisserieItem {
  key: string;                        // ex: "draps_1place"
  label: string;                      // ex: "Draps 1 place"
  price: number;                      // prix fixe en €
  enabled: boolean;
}

export interface CommissionConfig {
  category: string;                   // "entretien" | "travaux" | "exterieur" | "blanchisserie"
  enabled: boolean;
  rate: number;                       // pourcentage (ex: 15.0 = 15%)
}

export interface PrestationOption {
  key: string;                        // ex: "laundry", "ironing", "custom_xyz"
  label: string;                      // ex: "Linge", "Repassage"
}

export interface SurchargeOption {
  key: string;                        // ex: "perBedroom", "custom_surcharge_xyz"
  label: string;                      // ex: "Par chambre supplémentaire"
  unit: string;                       // ex: "€"
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
  forfaitConfigs: ForfaitConfig[];
  travauxConfig: ServicePriceConfig[];
  exterieurConfig: ServicePriceConfig[];
  blanchisserieConfig: BlanchisserieItem[];
  commissionConfigs: CommissionConfig[];
  availablePrestations: PrestationOption[];
  availableSurcharges: SurchargeOption[];
  // Monitoring sonore
  monitoringMinutEnabled: boolean;
  monitoringMinutMonthlyPriceCents: number;
  monitoringClenzyEnabled: boolean;
  monitoringClenzyDevicePriceCents: number;
  monitoringClenzyInstallationPriceCents: number;
  monitoringClenzyConfigPriceCents: number;
  monitoringClenzySupportPriceCents: number;
  updatedAt: string | null;
}

export type PricingConfigUpdate = Omit<PricingConfig, 'id' | 'updatedAt'>;

// NOTE: All DEFAULT_* constants have been removed.
// Default data is now seeded directly in the database via V36 migration.
// The backend returns empty arrays [] when no data exists.

// ─── API ──────────────────────────────────────────────────────────────────────

export const pricingConfigApi = {
  get() {
    return apiClient.get<PricingConfig>('/pricing-config');
  },

  update(data: PricingConfigUpdate) {
    return apiClient.put<PricingConfig>('/pricing-config', data);
  },
};
