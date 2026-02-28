import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface PricePrediction {
  date: string;
  suggestedPrice: number;
  confidence: number;       // 0..1
  demandScore: number;       // 0..1
  reason: string;
}

/* ─── API ─── */

export const aiPricingApi = {
  /** Get AI price suggestions for a property over a date range */
  getPredictions(propertyId: number, from: string, to: string) {
    return apiClient.get<PricePrediction[]>(`/ai/pricing/${propertyId}`, {
      params: { from, to },
    });
  },
};
