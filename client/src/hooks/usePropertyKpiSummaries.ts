import { useState, useEffect, useMemo } from 'react';
import { propertyKpiApi, type PropertyKpiSummary } from '../services/api/propertyKpiApi';

/**
 * Charge les KPI opérationnels (occupation / ADR / revenu / statut / interventions)
 * pour un lot de propriétés en UNE requête batchée, et les indexe par id.
 *
 * Dégradation silencieuse : en cas d'échec (endpoint absent avant rebuild, droit
 * manquant…) la map est vide → la carte affiche un état neutre, jamais d'erreur.
 */
export function usePropertyKpiSummaries(ids: number[]): Map<number, PropertyKpiSummary> {
  const [map, setMap] = useState<Map<number, PropertyKpiSummary>>(new Map());

  // Clé stable (ids triés) → ne refetch que si l'ensemble change réellement.
  const key = useMemo(() => [...ids].sort((a, b) => a - b).join(','), [ids]);

  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    let alive = true;
    const idList = key.split(',').map(Number);
    propertyKpiApi
      .getKpiSummaries(idList)
      .then((rows) => { if (alive) setMap(new Map(rows.map((r) => [r.propertyId, r]))); })
      .catch(() => { if (alive) setMap(new Map()); });
    return () => { alive = false; };
  }, [key]);

  return map;
}
