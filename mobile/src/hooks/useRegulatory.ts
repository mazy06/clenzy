import { useQuery, useQueries } from '@tanstack/react-query';
import { regulatoryApi, type AlurCompliance } from '@/api/endpoints/regulatoryApi';

const KEYS = {
  alur: (propertyId: number, year?: number) =>
    ['alur-compliance', propertyId, year ?? new Date().getFullYear()] as const,
};

/** Fetch ALUR compliance status for a single property */
export function useAlurCompliance(propertyId?: number, year?: number) {
  return useQuery<AlurCompliance>({
    queryKey: KEYS.alur(propertyId!, year),
    queryFn: () => regulatoryApi.getAlurCompliance(propertyId!, year),
    enabled: !!propertyId,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}

/** Fetch ALUR compliance for multiple properties (for dashboard alerts) */
export function useAlurComplianceMultiple(propertyIds: number[]) {
  return useQueries({
    queries: propertyIds.map((id) => ({
      queryKey: KEYS.alur(id),
      queryFn: () => regulatoryApi.getAlurCompliance(id),
      staleTime: 10 * 60 * 1000,
      enabled: !!id,
    })),
  });
}
