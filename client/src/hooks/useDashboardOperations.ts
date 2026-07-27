import { useQuery } from '@tanstack/react-query';
import {
  dashboardOperationsApi,
  type DashboardActionItems,
  type DashboardOperations,
  type DashboardUpcomingArrival,
} from '../services/api/dashboardOperationsApi';

/**
 * Blocs opérationnels du Dashboard.
 *
 * Trois requêtes distinctes plutôt qu'un appel unique : elles n'ont ni la même
 * fraîcheur ni la même durée de vie. La journée en cours bouge à chaque
 * arrivée ; les éléments à traiter ne changent qu'au fil de l'eau ; les
 * arrivées à venir sont quasi statiques sur la journée.
 *
 * Chaque bloc est enveloppé d'un `DashboardErrorBoundary` côté rendu : un
 * endpoint en échec masque **sa** carte, pas le dashboard.
 */

/** Arrivées, départs et ménages du jour. */
export function useDashboardToday(enabled = true) {
  return useQuery<DashboardOperations>({
    queryKey: ['dashboard', 'operations', 'today'],
    queryFn: () => dashboardOperationsApi.getToday(),
    // La journée en cours bouge : on la rafraîchit au retour sur l'onglet.
    staleTime: 60_000,
    enabled,
  });
}

/** Prochaines arrivées, fenêtre glissante. */
export function useDashboardUpcomingArrivals(days = 7, enabled = true) {
  return useQuery<DashboardUpcomingArrival[]>({
    queryKey: ['dashboard', 'upcoming-arrivals', days],
    queryFn: () => dashboardOperationsApi.getUpcomingArrivals(days),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Soldes à percevoir, avis sans réponse, calendriers désynchronisés. */
export function useDashboardActionItems(enabled = true) {
  return useQuery<DashboardActionItems>({
    queryKey: ['dashboard', 'action-items'],
    queryFn: () => dashboardOperationsApi.getActionItems(),
    staleTime: 2 * 60_000,
    enabled,
  });
}
