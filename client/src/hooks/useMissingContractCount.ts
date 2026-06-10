import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../services/api/propertiesApi';
import { useContractedPropertyIds } from './useContractedPropertyIds';

export interface MissingContracts {
  /** Nombre de propriétés sans contrat de gestion vivant. */
  count: number;
  /** Ids des propriétés concernées (pour préselectionner la modal de contrat). */
  missingPropertyIds: number[];
}

/**
 * Propriétés de l'organisation SANS contrat de gestion vivant
 * (DRAFT/ACTIVE/SUSPENDED). Alimente l'alerte « contrat manquant » du dashboard
 * et le gate de la liste des propriétés.
 *
 * @param enabled désactive les requêtes pour les rôles sans accès aux contrats.
 */
export function useMissingContractCount(enabled = true): MissingContracts {
  const { propertyIds } = useContractedPropertyIds(enabled);
  const { data: properties } = useQuery({
    queryKey: ['properties', 'contract-gate-count'],
    queryFn: () => propertiesApi.getAll(),
    enabled,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const missingPropertyIds = (properties ?? [])
      .filter((p) => !propertyIds.has(p.id))
      .map((p) => p.id);
    return { count: missingPropertyIds.length, missingPropertyIds };
  }, [properties, propertyIds]);
}
