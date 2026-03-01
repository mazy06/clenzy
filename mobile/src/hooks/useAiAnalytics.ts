import { useQuery } from '@tanstack/react-query';
import { aiAnalyticsApi, type RevenueAnalytics } from '@/api/endpoints/aiAnalyticsApi';

const KEYS = {
  analytics: (propertyId: number, from: string, to: string) =>
    ['ai-analytics', propertyId, from, to] as const,
};

/** Fetch AI-powered revenue analytics + occupancy forecast */
export function useAiAnalytics(propertyId?: number, from?: string, to?: string) {
  return useQuery<RevenueAnalytics>({
    queryKey: KEYS.analytics(propertyId!, from!, to!),
    queryFn: () => aiAnalyticsApi.getAnalytics(propertyId!, from!, to!),
    enabled: !!propertyId && !!from && !!to,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
