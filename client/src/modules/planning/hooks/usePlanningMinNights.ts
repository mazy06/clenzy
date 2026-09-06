import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

export const minNightsKeys = {
  all: ['planning-min-nights'] as const,
  /** Clé par LOT de logements (ids triés) et tranche — cf. pricingKeys.batch. */
  batch: (propertyIds: number[], from: string, to: string) =>
    [...minNightsKeys.all, 'batch', propertyIds.join(','), { from, to }] as const,
};

/** propertyId → dateStr → minNights override value */
export type MinNightsMap = Map<number, Map<string, number>>;

export interface UsePlanningMinNightsReturn {
  minNightsMap: MinNightsMap;
  isLoading: boolean;
}

/**
 * Charge les overrides de minimum de nuits pour toutes les proprietes du
 * planning sur la fenetre de buffer visible. Strategie identique a
 * usePlanningPricing : tranches de 30 j, UNE requete par tranche pour tout le
 * lot de logements, dedup premier-arrive.
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

  const sortedIds = useMemo(() => [...propertyIds].sort((a, b) => a - b), [propertyIds]);
  const active = enabled && sortedIds.length > 0;

  const { minNightsMap, isLoading } = useQueries({
    queries: active
      ? chunks.map((chunk) => ({
          queryKey: minNightsKeys.batch(sortedIds, chunk.from, chunk.to),
          queryFn: () => calendarPricingApi.getMinNightsOverridesBatch(sortedIds, chunk.from, chunk.to),
          staleTime: 60_000,
          gcTime: 5 * 60 * 1000,
        }))
      : [],
    combine: (results) => {
      const map: MinNightsMap = new Map();
      for (const result of results) {
        if (!result.data) continue;
        for (const ovr of result.data) {
          let dateMap = map.get(ovr.propertyId);
          if (!dateMap) {
            dateMap = new Map();
            map.set(ovr.propertyId, dateMap);
          }
          if (!dateMap.has(ovr.date)) dateMap.set(ovr.date, ovr.minNights);
        }
      }
      return { minNightsMap: map, isLoading: results.some((r) => r.isLoading) };
    },
  });

  return { minNightsMap, isLoading };
}
