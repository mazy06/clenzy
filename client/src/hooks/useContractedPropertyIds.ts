import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { managementContractsApi } from '../services/api/managementContractsApi';

export const contractedPropertyKeys = {
  all: ['management-contracts', 'contracted'] as const,
};

/**
 * Renvoie l'ensemble des `propertyId` ayant un contrat de gestion « vivant »
 * (statut DRAFT, ACTIVE ou SUSPENDED — on exclut TERMINATED/EXPIRED).
 *
 * Sert au gate « contrat manquant » (badge + bandeau) sur la liste des propriétés :
 * une propriété sans aucun contrat vivant doit être régularisée. Un brouillon créé via la
 * modal obligatoire suffit à lever le flag (l'activation reste une étape distincte).
 *
 * @param enabled désactive la requête pour les rôles sans accès aux contrats (évite un 403).
 */
export function useContractedPropertyIds(enabled = true): {
  propertyIds: Set<number>;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: contractedPropertyKeys.all,
    queryFn: () => managementContractsApi.getAll(),
    staleTime: 30_000,
    enabled,
  });

  const propertyIds = useMemo(
    () => new Set(
      (data ?? []).flatMap((c) =>
        c.status !== 'TERMINATED' && c.status !== 'EXPIRED' ? [c.propertyId] : [],
      ),
    ),
    [data],
  );

  return { propertyIds, isLoading };
}
