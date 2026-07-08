import apiClient from '../../services/apiClient';

/** Segment édité dans la modale : plage [from, to) (to exclusif, dates ISO) + remise % (baisse, positif). */
export interface PriceSegment {
  from: string;
  to: string;
  percent: number;
}

/** Un scénario (base ou projeté) renvoyé par le moteur de simulation. */
export interface PricingScenario {
  adr: number;
  occupancyRate: number; // 0..1
  nights: number;
  revenue: number;
}

/** Prévision d'un segment (miroir de SimulationService.PricingChangeResult). */
export interface SegmentForecast {
  from: string;
  to: string;
  pctChange: number; // signé (négatif = baisse)
  simulationDays: number;
  baseline: PricingScenario;
  scenario: PricingScenario;
  deltaRevenue: number;
  deltaOccupancy: number;
  recommendation: string;
}

/** Prévision multi-segment : par segment + cumul. */
export interface PricingSimulation {
  segments: SegmentForecast[];
  totalBaselineRevenue: number;
  totalScenarioRevenue: number;
  totalDeltaRevenue: number;
}

/** Endpoints de la modale d'ajustement tarifaire (yield multi-segment). */
export const pricingApi = {
  /** Prévision (read-only) de l'ajustement sur les segments édités. */
  simulate(propertyId: number, segments: PriceSegment[]): Promise<PricingSimulation> {
    return apiClient.post('/ai/supervision/simulate-pricing', { propertyId, segments });
  },
  /** Applique les segments validés → écrit les RateOverride (visibles dans « Prix dynamique »). */
  applyCustom(suggestionId: string, segments: PriceSegment[]): Promise<void> {
    return apiClient.post(`/ai/supervision/suggestions/${suggestionId}/apply-custom`, { segments });
  },
};
