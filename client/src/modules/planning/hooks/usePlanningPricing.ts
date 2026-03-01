import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { calendarPricingApi } from '../../../services/api';
import type { CalendarPricingDay } from '../../../services/api';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const pricingKeys = {
  all: ['planning-pricing'] as const,
  property: (propertyId: number, from: string, to: string) =>
    [...pricingKeys.all, propertyId, { from, to }] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

/** propertyId → dateStr → CalendarPricingDay */
export type PricingMap = Map<number, Map<string, CalendarPricingDay>>;

export interface UsePlanningPricingReturn {
  pricingMap: PricingMap;
  isLoading: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePlanningPricing(
  propertyIds: number[],
  bufferStart: Date,
  bufferEnd: Date,
  enabled: boolean,
): UsePlanningPricingReturn {
  // Compute 30-day aligned chunks (same strategy as usePlanningData)
  const chunks = useMemo(
    () => getOverlappingChunks(bufferStart, bufferEnd, DATA_CHUNK_SIZE_DAYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(bufferStart), toDateStr(bufferEnd)],
  );

  // Build query descriptors: one per (propertyId, chunk)
  const queryDescriptors = useMemo(() => {
    if (!enabled || propertyIds.length === 0) return [];
    return propertyIds.flatMap((propertyId) =>
      chunks.map((chunk) => ({
        propertyId,
        from: chunk.from,
        to: chunk.to,
      })),
    );
  }, [propertyIds, chunks, enabled]);

  const results = useQueries({
    queries: queryDescriptors.map((desc) => ({
      queryKey: pricingKeys.property(desc.propertyId, desc.from, desc.to),
      queryFn: () => calendarPricingApi.getPricing(desc.propertyId, desc.from, desc.to),
      enabled,
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  // Merge all chunk results into PricingMap
  const pricingMap = useMemo<PricingMap>(() => {
    const map: PricingMap = new Map();
    if (!enabled) return map;

    results.forEach((result, idx) => {
      if (!result.data) return;
      const desc = queryDescriptors[idx];
      if (!desc) return;

      let dateMap = map.get(desc.propertyId);
      if (!dateMap) {
        dateMap = new Map();
        map.set(desc.propertyId, dateMap);
      }
      for (const day of result.data) {
        // First writer wins (dedup across overlapping chunks)
        if (!dateMap.has(day.date)) {
          dateMap.set(day.date, day);
        }
      }
    });
    return map;
  }, [results, queryDescriptors, enabled]);

  const isLoading = enabled && results.some((r) => r.isLoading);

  return { pricingMap, isLoading };
}
