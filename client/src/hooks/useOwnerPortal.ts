import { useQuery } from '@tanstack/react-query';
import { ownerPortalApi } from '../services/api/ownerPortalApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const ownerPortalKeys = {
  dashboard: (ownerId: number) => ['owner-portal-dashboard', ownerId] as const,
  statement: (ownerId: number, from: string, to: string) =>
    ['owner-portal-statement', ownerId, from, to] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useOwnerDashboard(ownerId?: number) {
  return useQuery({
    queryKey: ownerPortalKeys.dashboard(ownerId ?? 0),
    queryFn: () => ownerPortalApi.getDashboard(ownerId!),
    enabled: !!ownerId,
    staleTime: 60_000,
  });
}

export function useOwnerStatement(
  ownerId?: number,
  from?: string,
  to?: string,
  ownerName?: string,
) {
  return useQuery({
    queryKey: ownerPortalKeys.statement(ownerId ?? 0, from ?? '', to ?? ''),
    queryFn: () => ownerPortalApi.getStatement(ownerId!, from!, to!, ownerName ?? ''),
    enabled: !!ownerId && !!from && !!to,
    staleTime: 60_000,
  });
}
