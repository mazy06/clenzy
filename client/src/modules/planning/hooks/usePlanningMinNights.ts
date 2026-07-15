import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';
import type { MinNightsOverride } from '../../../services/api';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const minNightsKeys = {
  all: ['planning-min-nights'] as const,
  property: (propertyId: number, from: string, to: string) =>
    [...minNightsKeys.all, propertyId, { from, to }] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

/** propertyId → dateStr → minNights override value */
export type MinNightsMap = Map<number, Map<string, number>>;

export interface UsePlanningMinNightsReturn {
  minNightsMap: MinNightsMap;
  isLoading: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Charge les overrides de minimum de nuits pour toutes les proprietes du
 * planning sur la fenetre de buffer visible. Strategie identique a
 * usePlanningPricing : chunks de 30j, useQueries batche, dedup first-wins.
 */
export function usePlanningMinNights(
  propertyIds: number[],
  bufferStart: Date,
  bufferEnd: Date,
  enabled: boolean,
): UsePlanningMinNightsReturn {
  const chunks = useMemo(
    () => getOverlappingChunks(bufferStart, bufferEnd, DATA_CHUNK_SIZE_DAYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(bufferStart), toDateStr(bufferEnd)],
  );

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
      queryKey: minNightsKeys.property(desc.propertyId, desc.from, desc.to),
      queryFn: () => calendarPricingApi.getMinNightsOverrides(desc.propertyId, desc.from, desc.to),
      enabled,
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  const minNightsMap = useMemo<MinNightsMap>(() => {
    const map: MinNightsMap = new Map();
    if (!enabled) return map;

    results.forEach((result, idx) => {
      const data = result.data as MinNightsOverride[] | undefined;
      if (!data) return;
      const desc = queryDescriptors[idx];
      if (!desc) return;

      let dateMap = map.get(desc.propertyId);
      if (!dateMap) {
        dateMap = new Map();
        map.set(desc.propertyId, dateMap);
      }
      for (const ovr of data) {
        if (!dateMap.has(ovr.date)) {
          dateMap.set(ovr.date, ovr.minNights);
        }
      }
    });
    return map;
  }, [results, queryDescriptors, enabled]);

  const isLoading = enabled && results.some((r) => r.isLoading);

  return { minNightsMap, isLoading };
}
