/* ============================================================
   Compteur de messages non lus (pastille du menu Messagerie)

   Lit GET /api/contact/unread-count : messages un-à-un reçus et non lus,
   plus les messages non lus des fils de GROUPE auxquels on participe — un
   devis soumis au propriétaire et à la conciergerie arrive par là.

   Requête de comptage agrégée côté serveur : aucun historique chargé.
   ============================================================ */

import { useQuery } from '@tanstack/react-query';

import { buildApiUrl } from '../config/api';
import { getAccessToken } from '../keycloak';

const QUERY_KEY = ['contact', 'unread-count'] as const;

async function fetchUnreadCount(): Promise<number> {
  const token = getAccessToken();
  const res = await fetch(buildApiUrl('/contact/unread-count'), {
    credentials: 'include',
    headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`unread-count ${res.status}`);
  const body = (await res.json()) as { count?: number };
  return body.count ?? 0;
}

/**
 * Nombre de messages non lus, poll 60 s.
 * @param enabled n'interroge le backend que si le hub Contacts est visible —
 *   les rôles qui n'y ont pas accès n'ont pas à déclencher un 403.
 */
export function useContactUnreadCount(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUnreadCount,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return data ?? 0;
}
