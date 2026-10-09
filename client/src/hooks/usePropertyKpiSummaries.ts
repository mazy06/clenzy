import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { propertyKpiApi, type PropertyKpiSummary } from '../services/api/propertyKpiApi';

/**
 * Charge les KPI opérationnels (occupation / ADR / revenu / statut / interventions)
 * pour un lot de propriétés en UNE requête batchée, et les indexe par id.
 * Cache de 30 secondes, isolé par utilisateur, organisation et mois.
 * Le chargement initial est explicite ; une actualisation conserve les données.
 *
 * Dégradation silencieuse : en cas d'échec (endpoint absent avant rebuild, droit
 * manquant…) la map est vide → la carte affiche un état neutre, jamais d'erreur.
 */
export function usePropertyKpiSummaries(ids: number[]): {
  map: Map<number, PropertyKpiSummary>;
  isLoading: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  // Clé stable (ids triés) → ne refetch que si l'ensemble change réellement.
  const key = useMemo(() => [...ids].sort((a, b) => a - b).join(','), [ids]);

  const enabled = !!key && !!user && !authLoading;
  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const query = useQuery({
    queryKey: ['property-kpi-summaries', user?.id, user?.organizationId, month, key],
    queryFn: () => propertyKpiApi.getKpiSummaries(key.split(',').map(Number)),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
  const map = useMemo(() => new Map<number, PropertyKpiSummary>(
    (query.data ?? []).map(row => [row.propertyId, row]),
  ), [query.data]);
  return { map, isLoading: enabled && query.isPending };
}
