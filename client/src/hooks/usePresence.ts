import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import StompService from '../services/StompService';
import TokenService from '../services/TokenService';
import { contactApi, type UserPresence } from '../services/api/contactApi';

/**
 * Presence hook — fetches presence for a set of user ids and stays in sync via STOMP.
 *
 * <h4>Design</h4>
 * <ul>
 *   <li>Initial state via bulk REST (`POST /presence/bulk`) — one request per render of the
 *   contact list, regardless of size.</li>
 *   <li>Realtime updates via the global STOMP topic {@code /topic/presence}; the cache is
 *   updated in place so subscribers re-render automatically.</li>
 *   <li>The hook is idempotent: multiple subscribers share the React Query cache, so calling it
 *   from several components only triggers one fetch and one subscription per session.</li>
 * </ul>
 */
export const presenceKeys = {
  all: ['presence'] as const,
  set: (userIds: string[]) => [...presenceKeys.all, [...userIds].sort()] as const,
  one: (userId: string) => [...presenceKeys.all, 'one', userId] as const,
};

export interface PresenceMap {
  [userId: string]: UserPresence;
}

/**
 * Subscribe to presence for the given user ids. Returns a stable map keyed by userId.
 *
 * @param userIds — list of user ids to watch. Pass an empty array to disable.
 */
export function usePresence(userIds: string[]): PresenceMap {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Stable dependency for hooks — content-based, not reference-based.
  const sortedIds = useMemo(() => {
    const filtered = userIds.filter((id) => !!id && id !== user?.id);
    return [...new Set(filtered)].sort();
  }, [userIds, user?.id]);

  // Initial bulk fetch — cheap and bounded by the contact list size.
  const { data } = useQuery({
    queryKey: presenceKeys.set(sortedIds),
    queryFn: () => contactApi.getBulkPresence(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 60 * 1000,
  });

  // Subscribe once to the global presence topic. Subsequent calls patch the cache.
  const subIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    const stomp = StompService.getInstance();
    stomp.connect(user.id, () => TokenService.getInstance().getCurrentToken());

    const subId = stomp.subscribe('/topic/presence', (event: UserPresence) => {
      if (!event?.userId) return;
      // Patch the bulk-keyed cache for any active subscriber.
      queryClient.setQueriesData<UserPresence[]>(
        { queryKey: presenceKeys.all },
        (existing) => {
          if (!Array.isArray(existing)) return existing;
          let mutated = false;
          const next = existing.map((p) => {
            if (p.userId !== event.userId) return p;
            mutated = true;
            return event;
          });
          if (!mutated && existing.some((p) => p.userId === event.userId)) return existing;
          return mutated ? next : existing;
        },
      );
    });
    subIdRef.current = subId;

    return () => {
      if (subIdRef.current) {
        stomp.unsubscribe(subIdRef.current);
        subIdRef.current = null;
      }
    };
  }, [user?.id, queryClient]);

  // Build the map for consumers (O(n) once per render).
  return useMemo<PresenceMap>(() => {
    const map: PresenceMap = {};
    (data ?? []).forEach((p) => {
      map[p.userId] = p;
    });
    return map;
  }, [data]);
}
