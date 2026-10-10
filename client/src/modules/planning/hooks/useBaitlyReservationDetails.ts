import { useCallback, useMemo } from 'react';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Reservation } from '../../../services/api';
import { planningDataApi, type PlanningData } from '../../../services/api/planningDataApi';
import { planningKeys, dedup } from './usePlanningData';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';
import { getOverlappingChunks, toDateStr } from '../utils/dateUtils';
import type { BaitlyLoadedReservationWindow } from '../utils/baitlyHydratedEvents';

function combineDetails(results: UseQueryResult<PlanningData, Error>[]) {
  return { reservations: dedup(results.flatMap((r) => r.data ? [r.data.reservations] : [])),
    error: results.find((r) => r.error)?.error?.message ?? null };
}

/** Hydrate seulement les séjours des lignes affichées et du panneau ouvert. */
export function useBaitlyReservationDetails(propertyIds: number[], from: Date, to: Date, enabled: boolean,
  priorityRange: { start: Date; end: Date } = { start: from, end: to }) {
  const batches = useMemo(() => {
    const ids = [...new Set(propertyIds)].sort((a, b) => a - b);
    const result: number[][] = [];
    for (let i = 0; i < ids.length; i += 100) result.push(ids.slice(i, i + 100));
    return result;
  }, [propertyIds]);
  const chunks = useMemo(() => getOverlappingChunks(from, to, DATA_CHUNK_SIZE_DAYS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateStr(from), toDateStr(to)]);
  const priorityFrom = toDateStr(priorityRange.start);
  const priorityTo = toDateStr(priorityRange.end);
  const requests = useMemo(() => batches.flatMap((ids) => chunks.map((chunk) => ({ ids, chunk,
    priority: chunk.from <= priorityTo && chunk.to >= priorityFrom }))),
    [batches, chunks, priorityFrom, priorityTo]);
  const client = useQueryClient();
  const prioritySettled = enabled && requests.filter((r) => r.priority).every(({ ids, chunk }) => {
    const state = client.getQueryState(planningKeys.data(ids, chunk.from, chunk.to, true));
    return !!state && (state.dataUpdatedAt > 0 || state.errorUpdatedAt > 0);
  });
  const combine = useCallback((results: UseQueryResult<PlanningData, Error>[]) => ({
    ...combineDetails(results),
    loadedWindows: results.flatMap((result, index): BaitlyLoadedReservationWindow[] => {
      const request = requests[index];
      return result.data !== undefined && request
        ? [{ propertyIds: request.ids, from: request.chunk.from, to: request.chunk.to }] : [];
    }),
    priorityReady: enabled && results.every((result, index) => !requests[index]?.priority
      || result.isSuccess || result.isError),
  }), [enabled, requests]);
  return useQueries({
    queries: requests.map(({ ids, chunk, priority }) => ({
      queryKey: planningKeys.data(ids, chunk.from, chunk.to, true),
      queryFn: ({ signal }: { signal: AbortSignal }) => planningDataApi.getReservationDetails(ids, chunk.from, chunk.to, signal),
      staleTime: 30_000,
      enabled: enabled && (priority || prioritySettled),
      gcTime: 5 * 60 * 1000,
    })),
    combine,
  });
}

/** Garder l'index global pour les conflits ; seules les données présentes sont enrichies. */
export function mergeBaitlyReservationDetails(index: Reservation[], details: Reservation[]): Reservation[] {
  const byId = new Map(details.map((r) => [r.id, r]));
  return index.map((r) => byId.get(r.id) ?? r);
}
