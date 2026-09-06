import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../../services/api';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

export const pricingKeys = {
  all: ['planning-pricing'] as const,
  /**
   * Clé par LOT de logements (ids triés) et tranche de dates. L'ancienne clé
   * était par logement : elle produisait N × tranches requêtes HTTP pour peindre
   * une seule grille — 10 logements sur 7 tranches, c'était 70 appels, à quoi
   * s'ajoutaient les 70 de min-nights, sur un quota de 300 req/min.
   */
  batch: (propertyIds: number[], from: string, to: string) =>
    [...pricingKeys.all, 'batch', propertyIds.join(','), { from, to }] as const,
};

/** propertyId → dateStr → CalendarPricingDay */
export type PricingMap = Map<number, Map<string, CalendarPricingDay>>;

export interface UsePlanningPricingReturn {
  pricingMap: PricingMap;
  isLoading: boolean;
}

export function usePlanningPricing(
  propertyIds: number[],
  bufferStart: Date,
  bufferEnd: Date,
  enabled: boolean,
): UsePlanningPricingReturn {
  const chunks = useMemo(
    () => getOverlappingChunks(bufferStart, bufferEnd, DATA_CHUNK_SIZE_DAYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(bufferStart), toDateStr(bufferEnd)],
  );

  // Ids triés : l'ordre de la page ne doit pas produire une clé de cache
  // différente pour le même lot.
  const sortedIds = useMemo(() => [...propertyIds].sort((a, b) => a - b), [propertyIds]);
  const active = enabled && sortedIds.length > 0;

  // `combine` : sans lui, `useQueries` rend un tableau d'identité neuve à chaque
  // rendu, la map dérivée était donc recalculée en boucle et cassait la
  // barrière de mémo de toute la grille.
  const { pricingMap, isLoading } = useQueries({
    queries: active
      ? chunks.map((chunk) => ({
          queryKey: pricingKeys.batch(sortedIds, chunk.from, chunk.to),
          queryFn: () => calendarPricingApi.getPricingBatch(sortedIds, chunk.from, chunk.to),
          staleTime: 60_000,
          gcTime: 5 * 60 * 1000,
        }))
      : [],
    combine: (results) => {
      const map: PricingMap = new Map();
      for (const result of results) {
        if (!result.data) continue;
        for (const day of result.data) {
          let dateMap = map.get(day.propertyId);
          if (!dateMap) {
            dateMap = new Map();
            map.set(day.propertyId, dateMap);
          }
          // Premier arrivé gagne : les tranches se recouvrent sur leurs bords.
          if (!dateMap.has(day.date)) dateMap.set(day.date, day);
        }
      }
      return { pricingMap: map, isLoading: results.some((r) => r.isLoading) };
    },
  });

  return { pricingMap, isLoading };
}
