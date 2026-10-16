import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import type { MapBounds, PropertyMarker } from "../components/BaitlyPropertyMap";

/** Taille des lots servis par /api/mission-map (MissionMapQueryService.PAGE_SIZE). */
export const MISSION_MAP_PAGE_SIZE = 20;
export type MissionMapKind = "service-requests" | "interventions" | "prestations";
/** Filtres serveur. `category`, `from`/`to` (aaaa-mm-jj, inclus) et l'intervenant servent à l'écran Prestations. */
export interface MissionMapFilters {
  search: string; type: string; status: string; priority: string; propertyId?: number;
  category?: string; from?: string; to?: string; assigneeType?: "user" | "team"; assigneeId?: number;
}
export interface MissionMapOverview { markers: Array<Omit<PropertyMarker, "state"> & { state?: string; kind?: "intervention" | "request"; propertyId?: number | null }>; total: number; late: number; today: number; completed: number }
export interface MissionMapPage<T> { content: T[]; totalElements: number; number: number; last: boolean }
// Les prestations se rangent sous ["interventions"] : `invalidateMissionWorkflow`, appelé après
// chaque décision sur une demande ou une intervention, les relit avec le reste.
const keys = (kind: MissionMapKind) => kind === "service-requests" ? ["service-requests-list", "map"]
  : kind === "prestations" ? ["interventions", "list", "prestations"] : ["interventions", "list", "map"];

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

/** Page de la liste de l'écran (sans restriction géographique), lots de 20. */
export function useMissionList<T>(kind: MissionMapKind, filters: MissionMapFilters, page: number, enabled = true) {
  return useQuery({
    queryKey: [...keys(kind), "list", filters, page],
    queryFn: ({ signal }) => apiClient.get<MissionMapPage<T>>("/mission-map/" + kind + "/list", { params: { ...filters, page }, signal }),
    enabled, staleTime: 30_000, placeholderData: keepPreviousData,
  });
}

/** Export explicite : aucun préchargement de fiches au montage de la carte. */
export async function fetchMissionMapExport<T>(kind: MissionMapKind, filters: MissionMapFilters,
  source: "page" | "list" = "page"): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const batch = await apiClient.get<MissionMapPage<T>>("/mission-map/" + kind + "/" + source, { params: { ...filters, page } });
    rows.push(...batch.content);
    if (batch.last) return rows;
  }
}
