import { useQuery } from '@tanstack/react-query';
import { aiPricingApi, type PricePrediction } from '@/api/endpoints/aiPricingApi';

const KEYS = {
  predictions: (propertyId: number, from: string, to: string) =>
    ['ai-pricing', propertyId, from, to] as const,
};

/** Fetch AI price predictions for a property */
export function useAiPricing(propertyId?: number, from?: string, to?: string) {
  return useQuery<PricePrediction[]>({
    queryKey: KEYS.predictions(propertyId!, from!, to!),
    queryFn: () => aiPricingApi.getPredictions(propertyId!, from!, to!),
    enabled: !!propertyId && !!from && !!to,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
