/* ============================================================
   Compteur d'échecs récents Documents & Communications (pastille menu)

   Lit GET /api/documents/alerts/failed-count (org-scopé) : envois voyageur
   FAILED + générations de documents FAILED sur les 7 derniers jours. Léger :
   requête de comptage agrégée côté backend, sans charger l'historique.

   Clé react-query partagée : un seul poll dédupliqué (60 s).
   ============================================================ */

import { useQuery } from '@tanstack/react-query';

import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';

const QUERY_KEY = ['documents', 'failed-count'] as const;

async function fetchFailedCount(): Promise<number> {
  const token = getAccessToken();
  const res = await fetch(buildApiUrl('/documents/alerts/failed-count'), {
    credentials: 'include',
    headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`failed-count ${res.status}`);
  const body = (await res.json()) as { count?: number };
  return body.count ?? 0;
}

/**
 * Nombre d'échecs récents (messages + documents), poll 60 s.
 * @param enabled n'interroge le backend que si le hub Documents est visible
 *   pour l'utilisateur (évite tout fetch inutile / 403 des rôles terrain).
 */
export function useDocumentsFailedCount(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFailedCount,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return data ?? 0;
}
