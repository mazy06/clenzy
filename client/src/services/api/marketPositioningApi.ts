import apiClient from '../apiClient';

/** Positionnement d'un bien face au marché — miroir du DTO backend MarketPositioningDto. */
export interface MarketPositioning {
  area: string | null;
  propertyAdr: number | null;
  propertyOccupancyPct: number | null;
  marketAdr: number | null;
  marketOccupancyPct: number | null;
  currency: string | null;
  deltaPct: number | null;
  positioning: 'UNDERPRICED' | 'ALIGNED' | 'OVERPRICED' | 'NO_MARKET_DATA';
  source: string | null;
  confidence: number | null;
  headline: string;
}

export const marketPositioningApi = {
  get: (propertyId: number) =>
    apiClient.get<MarketPositioning>(`/analytics/market-positioning/${propertyId}`),
};
