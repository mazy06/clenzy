import type { MissionMapFilters } from '../../hooks/useMissionMap';
import type { Intervention } from '../interventions/useInterventionsList';
import type { ServiceRequestApiResponse } from '../service-requests/serviceRequestsUtils';
import { addDays, isoDay, startOfDay } from '../properties/prestations/prestationTimeline';

/**
 * Ligne de l'écran Prestations, telle que le serveur la renvoie : la fiche habituelle de son
 * type. Une demande déjà transformée en intervention n'y figure qu'une fois, sous sa forme
 * d'intervention (le serveur ne lit que les demandes encore ouvertes).
 */
export type PrestationRow =
  | { id: string; kind: 'intervention'; item: Intervention }
  | { id: string; kind: 'request'; item: ServiceRequestApiResponse };

export type PrestationCategory = 'all' | 'intervention' | 'request';
export type PrestationPeriod = 'all' | 'today' | 'next7' | 'next30' | 'past30';

export interface PrestationFilterState {
  search: string;
  category: PrestationCategory;
  status: string;
  period: PrestationPeriod;
  /** `user:<id>`, `team:<id>` ou `all`. */
  assignee: string;
  propertyId?: number;
}

/** Bornes incluses (aaaa-mm-jj) de la période choisie, relative à `now`. */
export function periodRange(period: PrestationPeriod, now: Date): { from?: string; to?: string } {
  const today = startOfDay(now);
  switch (period) {
    case 'today': return { from: isoDay(today), to: isoDay(today) };
    case 'next7': return { from: isoDay(today), to: isoDay(addDays(today, 6)) };
    case 'next30': return { from: isoDay(today), to: isoDay(addDays(today, 29)) };
    case 'past30': return { from: isoDay(addDays(today, -30)), to: isoDay(addDays(today, -1)) };
    default: return {};
  }
}

export function parseAssignee(value: string): { assigneeType?: 'user' | 'team'; assigneeId?: number } {
  const match = /^(user|team):(\d+)$/.exec(value);
  return match ? { assigneeType: match[1] as 'user' | 'team', assigneeId: Number(match[2]) } : {};
}

const isSet = (value: string) => value !== '' && value !== 'all';

/** Filtres serveur de l'écran (liste ET carte partagent les mêmes). */
export function buildPrestationFilters(state: PrestationFilterState, now: Date): MissionMapFilters {
  return {
    search: state.search,
    type: 'all',
    status: isSet(state.status) ? state.status : 'all',
    priority: 'all',
    propertyId: state.propertyId,
    category: state.category === 'all' ? undefined : state.category,
    ...periodRange(state.period, now),
    ...parseAssignee(state.assignee),
  };
}

/** Valeur du filtre de type portée par les anciens onglets (`?tab=…`) et par `?type=`. */
export function categoryFromParam(value: string | null): PrestationCategory {
  if (value === 'interventions' || value === 'intervention') return 'intervention';
  if (value === 'service-requests' || value === 'requests' || value === 'request') return 'request';
  return 'all';
}

/**
 * Où mènent les anciens onglets « Interventions » et « Demandes de service » et l'onglet
 * Prestations. Un prestataire garde l'onglet Prestations (pré-filtré sur le type) ; un
 * gestionnaire ou un hôte arrive sur la vue Prestations de la carte des logements. Une
 * notification qui surlignait une demande (`highlight`) ouvre directement sa fiche.
 * Renvoie `null` si l'URL est déjà la bonne.
 */
export function legacyWorkOrdersTarget(search: string, providerView = false): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  // Anomalies : vue Anomalies de la carte, qui ouvre celle qu'une notification surlignait.
  if (tab === 'issues' && !providerView) {
    const target = new URLSearchParams({ tab: 'issues' });
    const issue = params.get('highlight');
    if (issue && /^\d+$/.test(issue)) target.set('issue', issue);
    return `/properties?${target.toString()}`;
  }
  if (tab !== 'interventions' && tab !== 'service-requests' && tab !== 'prestations') return null;
  if (tab === 'prestations' && providerView) return null;
  const highlight = params.get('highlight');
  if (tab === 'service-requests' && highlight && /^\d+$/.test(highlight)) return `/service-requests/${highlight}`;
  const type = tab === 'interventions' ? 'interventions' : tab === 'service-requests' ? 'requests' : params.get('type');
  if (!providerView) {
    const target = new URLSearchParams({ tab: 'prestations' });
    if (type) target.set('type', type);
    return `/properties?${target.toString()}`;
  }
  params.set('tab', 'prestations');
  if (type) params.set('type', type);
  params.delete('highlight');
  return `/interventions?${params.toString()}`;
}
