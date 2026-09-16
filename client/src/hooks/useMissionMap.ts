import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import type { MapBounds, PropertyMarker } from "../components/MapboxPropertyMap";

export type MissionMapKind = "service-requests" | "interventions";
export interface MissionMapFilters { search: string; type: string; status: string; priority: string; propertyId?: number }
export interface MissionMapOverview { markers: PropertyMarker[]; total: number; late: number; today: number; completed: number }
export interface MissionMapPage<T> { content: T[]; totalElements: number; number: number; last: boolean }
const keys = (kind: MissionMapKind) => kind === "service-requests" ? ["service-requests-list", "map"] : ["interventions", "list", "map"];

export function useMissionMapFilters(search: string, type: string, status: string, priority: string) {
  const [params] = useSearchParams();
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const propertyId = params.get("propertyId");
  return useMemo(() => ({ search: debouncedSearch, type, status, priority,
    propertyId: propertyId ? Number(propertyId) : undefined }), [debouncedSearch, type, status, priority, propertyId]);
}

export function useMissionMapOverview(kind: MissionMapKind, filters: MissionMapFilters, enabled = true) {
  return useQuery({
    queryKey: [...keys(kind), "overview", filters],
    queryFn: ({ signal }) => apiClient.get<MissionMapOverview>("/mission-map/" + kind + "/overview", { params: { ...filters }, signal }),
    enabled, staleTime: 30_000,
  });
}

export function useMissionMapPages<T>(kind: MissionMapKind, filters: MissionMapFilters, bounds: MapBounds | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...keys(kind), "pages", filters, bounds],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => apiClient.get<MissionMapPage<T>>("/mission-map/" + kind + "/page",
      { params: { ...filters, ...bounds, page: pageParam }, signal }),
    getNextPageParam: last => last.last ? undefined : last.number + 1,
    enabled: enabled && bounds !== null,
    staleTime: 30_000,
    retry: false,
  });
}

/** Export explicite : aucun préchargement de fiches au montage de la carte. */
export async function fetchMissionMapExport<T>(kind: MissionMapKind, filters: MissionMapFilters): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const batch = await apiClient.get<MissionMapPage<T>>("/mission-map/" + kind + "/page", { params: { ...filters, page } });
    rows.push(...batch.content);
    if (batch.last) return rows;
  }
}
