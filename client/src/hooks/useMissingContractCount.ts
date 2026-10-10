import { useMemo } from 'react';
import { usePropertiesList } from './usePropertiesList';
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
  // Les photos des widgets et le contrôle des contrats partagent la même liste.
  const { properties } = usePropertiesList(enabled);

  return useMemo(() => {
    const missingPropertyIds = properties.flatMap((p) =>
      propertyIds.has(Number(p.id)) ? [] : [Number(p.id)],
    );
    return { count: missingPropertyIds.length, missingPropertyIds };
  }, [properties, propertyIds]);
}
