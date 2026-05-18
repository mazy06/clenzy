import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { channelSyncHealthApi } from '../../../services/api';
import type { ChannelSyncHealth } from '../../../services/api';

export const channelSyncKeys = {
  all: ['planning-channel-sync'] as const,
  forProperties: (propertyIds: number[]) =>
    [...channelSyncKeys.all, propertyIds.slice().sort((a, b) => a - b).join(',')] as const,
};

/** propertyId → { synced, total } */
export type ChannelSyncMap = Map<number, ChannelSyncHealth>;

export interface UsePlanningChannelSyncReturn {
  channelSyncMap: ChannelSyncMap;
  isLoading: boolean;
}

/**
 * Recupere l'etat de sync multi-canaux pour toutes les proprietes visibles
 * dans le planning. L'etat est global (pas per-date) car la sync est un
 * agregat current : "X de mes Y canaux sont OK maintenant".
 *
 * staleTime 2min : un canal qui vient de re-sync se reflete sans hammer
 * l'API a chaque scroll.
 */
export function usePlanningChannelSync(
  propertyIds: number[],
  enabled: boolean,
): UsePlanningChannelSyncReturn {
  const sortedIds = useMemo(
    () => [...propertyIds].sort((a, b) => a - b),
    [propertyIds],
  );

  const query = useQuery({
    queryKey: channelSyncKeys.forProperties(sortedIds),
    queryFn: () => channelSyncHealthApi.getHealth(sortedIds),
    enabled: enabled && sortedIds.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const channelSyncMap = useMemo<ChannelSyncMap>(() => {
    const map: ChannelSyncMap = new Map();
    const data = query.data;
    if (!data) return map;
    for (const [pidStr, health] of Object.entries(data)) {
      const pid = Number(pidStr);
      if (Number.isNaN(pid)) continue;
      map.set(pid, health);
    }
    return map;
  }, [query.data]);

  return { channelSyncMap, isLoading: query.isLoading };
}
