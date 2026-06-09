import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../services/api/propertiesApi';
import { useContractedPropertyIds } from './useContractedPropertyIds';

/**
 * Nombre de propriétés de l'organisation SANS contrat de gestion vivant
 * (DRAFT/ACTIVE/SUSPENDED). Alimente l'alerte « contrat manquant » du dashboard
 * et le gate de la liste des propriétés.
 *
 * @param enabled désactive les requêtes pour les rôles sans accès aux contrats.
 */
export function useMissingContractCount(enabled = true): number {
  const { propertyIds } = useContractedPropertyIds(enabled);
  const { data: properties } = useQuery({
    queryKey: ['properties', 'contract-gate-count'],
    queryFn: () => propertiesApi.getAll(),
    enabled,
    staleTime: 30_000,
  });

  return useMemo(
    () => (properties ?? []).filter((p) => !propertyIds.has(p.id)).length,
    [properties, propertyIds],
  );
}
