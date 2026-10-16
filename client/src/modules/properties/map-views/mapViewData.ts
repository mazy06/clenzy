import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMissionMapOverview, type MissionMapFilters, type MissionMapOverview } from '../../../hooks/useMissionMap';
import type { MarkerState } from '../../../components/map/markerStates';
import { reservationsApi, type Reservation } from '../../../services/api/reservationsApi';
import { issuesApi, type Issue, type IssueSeverity } from '../../../services/api/issuesApi';
import { addDays, isoDay, startOfDay } from '../prestations/prestationTimeline';
import { buildPrestationFilters, type PrestationCategory } from '../../prestations/prestationFilters';

/** Rang d'urgence d'un état de mission : l'épingle d'un logement prend le plus urgent. */
const MISSION_RANK: Record<string, number> = { late: 4, today: 3, planned: 2, done: 1, closed: 0 };
const MISSION_RING: Record<string, MarkerState | undefined> = { late: 'late', today: 'today', done: 'done', closed: 'closed' };

/** Missions de la carte regroupées par logement : leur nombre et l'état le plus urgent. */
export function groupMissionsByProperty(markers: MissionMapOverview['markers']): Map<number, { count: number; state?: MarkerState }> {
  const best = new Map<number, { count: number; rank: number; state?: string }>();
  for (const marker of markers) {
    if (marker.propertyId == null) continue;
    const rank = MISSION_RANK[marker.state ?? 'planned'] ?? 2;
    const entry = best.get(marker.propertyId);
    if (!entry) best.set(marker.propertyId, { count: 1, rank, state: marker.state });
    else best.set(marker.propertyId, { count: entry.count + 1, rank: Math.max(entry.rank, rank),
      state: rank > entry.rank ? marker.state : entry.state });
  }
  return new Map([...best].map(([id, entry]) => [id, { count: entry.count, state: MISSION_RING[entry.state ?? ''] }]));
}

/** Prestations de la vue carte (interventions + demandes ouvertes), filtrées par type. */
export function usePrestationPins(category: PrestationCategory, enabled: boolean,
  scope?: { from?: string; to?: string; propertyIds?: string }) {
  const filters = useMemo<MissionMapFilters>(() => buildPrestationFilters(
    { search: '', category, status: 'all', period: 'all', assignee: 'all' }, new Date()), [category]);
  const scopedFilters = useMemo(() => ({ ...filters, ...scope }), [filters, scope?.from, scope?.to, scope?.propertyIds]);
  const overview = useMissionMapOverview('prestations', scopedFilters, enabled);
  const byProperty = useMemo(() => groupMissionsByProperty(overview.data?.markers ?? []), [overview.data]);
  return { filters: scopedFilters, overview, byProperty };
}

/** Fenêtre des réservations de la carte : en cours et à venir sur 30 jours. */
export const RESERVATION_WINDOW_DAYS = 30;

export function useReservationWindow(enabled: boolean, propertyIds?: number[], range?: { from?: string; to?: string }) {
  const today = startOfDay(new Date());
  const from = range ? range.from : isoDay(today);
  const to = range ? range.to : isoDay(addDays(today, RESERVATION_WINDOW_DAYS));
  return useQuery({
    queryKey: ['reservations', 'map-window', from, to, propertyIds ?? 'all'],
    queryFn: () => reservationsApi.getAll({ from, to, propertyIds }),
    enabled: enabled && (!propertyIds || propertyIds.length > 0),
    staleTime: 60_000,
    select: (rows: Reservation[]) => rows
      .filter((reservation) => reservation.status !== 'cancelled')
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
  });
}

/** Anomalies encore à traiter (ouvertes ou qualifiées) : la vue Anomalies et la pastille d'alerte. */
const OPEN_ISSUE_STATUSES = new Set(['OPEN', 'QUALIFIED']);
const SEVERITY_RANK: Record<IssueSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function useOpenIssues(enabled = true) {
  return useQuery({
    queryKey: ['issues', 'map-open'],
    queryFn: () => issuesApi.list(),
    enabled,
    staleTime: 60_000,
    select: (issues: Issue[]) => issues
      .filter((issue) => OPEN_ISSUE_STATUSES.has(issue.status))
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.createdAt.localeCompare(a.createdAt)),
  });
}

/** Anomalie la plus grave de chaque logement, pour la pastille de son épingle. */
export function worstIssueByProperty(issues: Issue[]): Map<number, IssueSeverity> {
  const worst = new Map<number, IssueSeverity>();
  for (const issue of issues) {
    const current = worst.get(issue.propertyId);
    if (!current || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[current]) worst.set(issue.propertyId, issue.severity);
  }
  return worst;
}
