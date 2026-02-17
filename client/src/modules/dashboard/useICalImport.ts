import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iCalApi } from '../../services/api/iCalApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import { usersApi } from '../../services/api/usersApi';
import { planningKeys } from '../../hooks/useDashboardPlanning';
import type { ICalPreviewRequest, ICalImportRequest } from '../../services/api/iCalApi';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ICalOwner {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const iCalKeys = {
  all: ['ical'] as const,
  access: () => [...iCalKeys.all, 'access'] as const,
  properties: () => [...iCalKeys.all, 'properties'] as const,
  owners: () => [...iCalKeys.all, 'owners'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Check if user has access to iCal import (forfait check) */
export function useICalAccess(enabled: boolean) {
  return useQuery({
    queryKey: iCalKeys.access(),
    queryFn: () => iCalApi.checkAccess(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min — forfait doesn't change often
  });
}

/** Load properties for the select dropdown */
export function useICalProperties(enabled: boolean) {
  return useQuery<Property[]>({
    queryKey: iCalKeys.properties(),
    queryFn: async (): Promise<Property[]> => {
      const data = await propertiesApi.getAll({ size: 500, sort: 'name,asc' });
      const list: Property[] = Array.isArray(data) ? data : (data as any).content ?? [];
      return list;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/** Load owners (hosts) for admin/manager */
export function useICalOwners(enabled: boolean) {
  return useQuery<ICalOwner[]>({
    queryKey: iCalKeys.owners(),
    queryFn: async (): Promise<ICalOwner[]> => {
      const data = await usersApi.getAll({ role: 'HOST' });
      return Array.isArray(data) ? data : (data as any).content ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Preview iCal feed (Step 1 → 2) */
export function useICalPreview() {
  return useMutation({
    mutationFn: (data: ICalPreviewRequest) => iCalApi.previewFeed(data),
  });
}

/** Import iCal feed (Step 2 → 3) — invalidates planning queries on success */
export function useICalImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICalImportRequest) => iCalApi.importFeed(data),
    onSuccess: () => {
      // Invalidate planning reservations so the grid refreshes with new imports
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
    },
  });
}
