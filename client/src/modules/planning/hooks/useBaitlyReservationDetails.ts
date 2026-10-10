import { useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import type { Reservation } from '../../../services/api';
import { planningDataApi, type PlanningData } from '../../../services/api/planningDataApi';
import { planningKeys, dedup } from './usePlanningData';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';

function combineDetails(results: UseQueryResult<PlanningData, Error>[]) {
  return { reservations: dedup(results.flatMap((r) => r.data ? [r.data.reservations] : [])),
    error: results.find((r) => r.error)?.error?.message ?? null };
}

/** Hydrate seulement les séjours des lignes affichées et du panneau ouvert. */
export function useBaitlyReservationDetails(propertyIds: number[], from: Date, to: Date, enabled: boolean) {
  const batches = useMemo(() => {
    const ids = [...new Set(propertyIds)].sort((a, b) => a - b);
    const result: number[][] = [];
    for (let i = 0; i < ids.length; i += 100) result.push(ids.slice(i, i + 100));
    return result;
  }, [propertyIds]);
  const chunks = useMemo(() => getOverlappingChunks(from, to, DATA_CHUNK_SIZE_DAYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(from), toDateStr(to)]);
  return useQueries({
    queries: enabled ? batches.flatMap((ids) => chunks.map((chunk) => ({
      queryKey: planningKeys.data(ids, chunk.from, chunk.to, true),
      queryFn: ({ signal }: { signal: AbortSignal }) => planningDataApi.getReservationDetails(ids, chunk.from, chunk.to, signal),
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
    }))) : [],
    combine: combineDetails,
  });
}

/** Garder l'index global pour les conflits ; seules les données présentes sont enrichies. */
export function mergeBaitlyReservationDetails(index: Reservation[], details: Reservation[]): Reservation[] {
  const byId = new Map(details.map((r) => [r.id, r]));
  return index.map((r) => byId.get(r.id) ?? r);
}
