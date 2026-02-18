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
  updatedAt: string | null;
}

export type PricingConfigUpdate = Omit<PricingConfig, 'id' | 'updatedAt'>;

// ─── Default forfait configs (fallback if backend has no data) ───────────────

const DEFAULT_SURFACE_BASE_PRICES: SurfaceBasePrice[] = [
  { maxSurface: 30,   base: 35 },
  { maxSurface: 50,   base: 45 },
  { maxSurface: 70,   base: 55 },
  { maxSurface: 100,  base: 70 },
  { maxSurface: 150,  base: 90 },
  { maxSurface: null,  base: 110 },
];

const DEFAULT_SURCHARGES: Record<string, number> = {
  perBedroom: 5,
  perBathroom: 4,
  perFloor: 8,
  exterior: 12,
  laundry: 8,
  perGuestAbove4: 3,
};

export const DEFAULT_FORFAIT_CONFIGS: ForfaitConfig[] = [
  {
    key: 'CLEANING',
    label: 'Standard',
    coeffMin: 1.0,
    coeffMax: 1.0,
    serviceTypes: ['CLEANING', 'FLOOR_CLEANING', 'BATHROOM_CLEANING', 'KITCHEN_CLEANING'],
    includedPrestations: ['laundry', 'exterior'],
    extraPrestations: ['ironing', 'deepKitchen', 'disinfection', 'windows', 'frenchDoors', 'slidingDoors'],
    eligibleTeamIds: [],
    surcharges: { ...DEFAULT_SURCHARGES },
    surfaceBasePrices: [...DEFAULT_SURFACE_BASE_PRICES],
  },
  {
    key: 'EXPRESS_CLEANING',
    label: 'Express',
    coeffMin: 0.7,
    coeffMax: 0.85,
    serviceTypes: ['EXPRESS_CLEANING'],
    includedPrestations: [],
    extraPrestations: ['laundry', 'exterior', 'ironing', 'deepKitchen', 'disinfection', 'windows', 'frenchDoors', 'slidingDoors'],
    eligibleTeamIds: [],
    surcharges: { ...DEFAULT_SURCHARGES },
    surfaceBasePrices: [...DEFAULT_SURFACE_BASE_PRICES],
  },
  {
    key: 'DEEP_CLEANING',
    label: 'En profondeur',
    coeffMin: 1.4,
    coeffMax: 1.7,
    serviceTypes: ['DEEP_CLEANING', 'WINDOW_CLEANING'],
    includedPrestations: ['laundry', 'exterior', 'ironing', 'deepKitchen', 'windows', 'frenchDoors', 'slidingDoors'],
    extraPrestations: ['disinfection'],
    eligibleTeamIds: [],
    surcharges: { ...DEFAULT_SURCHARGES },
    surfaceBasePrices: [...DEFAULT_SURFACE_BASE_PRICES],
  },
];

// ─── API ──────────────────────────────────────────────────────────────────────

export const pricingConfigApi = {
  get() {
    return apiClient.get<PricingConfig>('/pricing-config');
  },

  update(data: PricingConfigUpdate) {
    return apiClient.put<PricingConfig>('/pricing-config', data);
  },
};
