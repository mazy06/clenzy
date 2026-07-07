/* ============================================================
   Compteurs de suggestions HITL en attente (pastilles du planning)

   Lit GET /api/ai/supervision/pending-counts (org-scopé) : total (badge du
   menu « Planning ») + détail par logement (badge de chaque cellule). Léger :
   requête de comptage agrégée côté backend, sans charger les cartes.

   Clé react-query PARTAGÉE : le menu et le planning consomment le même hook →
   un seul poll dédupliqué (30 s), rafraîchi en tâche de fond.
   ============================================================ */

import { useQuery } from '@tanstack/react-query';

import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface SupervisionPendingCounts {
  /** Total de suggestions en attente de l'organisation (badge menu). */
  total: number;
  /** Détail par logement : { [propertyId]: count } (badge de cellule). */
  byProperty: Record<string, number>;
}

const EMPTY: SupervisionPendingCounts = { total: 0, byProperty: {} };
const QUERY_KEY = ['supervision', 'pending-counts'] as const;

async function fetchPendingCounts(): Promise<SupervisionPendingCounts> {
  const token = getAccessToken();
  const res = await fetch(buildApiUrl('/ai/supervision/pending-counts'), {
    credentials: 'include',
    headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`pending-counts ${res.status}`);
  return (await res.json()) as SupervisionPendingCounts;
}

/**
 * Compteurs de suggestions en attente, poll 30 s.
 * @param enabled n'interroge le backend que pour un utilisateur habilité ET une
 *   org qui a activé la constellation (évite tout fetch inutile).
 */
export function useSupervisionPendingCounts(enabled: boolean): SupervisionPendingCounts {
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPendingCounts,
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  return data ?? EMPTY;
}
