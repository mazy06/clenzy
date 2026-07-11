/* ============================================================
   Règles d'auto-application par type (Vague 1 autonomie constellation)

   Lit/écrit GET|PUT /api/ai/supervision/auto-rules. Source de vérité =
   backend (SupervisionConfigController). Catalogue V1 fixé côté serveur
   (CLEANING_REQUEST, REVIEW_DRAFT_REPLY, PRICE_DROP) — défaut tout OFF.
   Le plafond du module (moduleCeiling) est calculé serveur, lecture seule.
   ============================================================ */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';
import type { AutonomyLevel } from './types';

/** Règle d'auto-application d'un type, telle qu'exposée par le backend. */
export interface SupervisionAutoRule {
  actionType: string;
  /** Module (agent) porteur du type — lecture seule. */
  moduleKey: string;
  enabled: boolean;
  /** Niveau demandé : 'notify' (auto + notification) | 'full' (silencieux + feed). */
  level: 'notify' | 'full';
  /** Enveloppe JSON éditable (null = défauts serveur). */
  envelope: string | null;
  /** Plafond du module ('suggest'|'notify'|'full') — lecture seule. */
  moduleCeiling: AutonomyLevel;
}

const QUERY_KEY = ['supervision', 'auto-rules'] as const;

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAutoRules(): Promise<SupervisionAutoRule[]> {
  const response = await fetch(buildApiUrl('/ai/supervision/auto-rules'), {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json', ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(`supervision auto-rules fetch failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionAutoRule[];
}

async function putAutoRules(rules: SupervisionAutoRule[]): Promise<SupervisionAutoRule[]> {
  const response = await fetch(buildApiUrl('/ai/supervision/auto-rules'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(rules),
  });
  if (!response.ok) {
    throw new Error(`supervision auto-rules update failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionAutoRule[];
}

/** Règles d'auto-application de l'org. `enabled` (param) gate la requête (rôles). */
export function useSupervisionAutoRules(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAutoRules,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    retry: false, // 403 pour les rôles sans supervision → la section se masque
  });
}

/** Upsert des règles (le backend accepte une liste partielle) ; met le cache à jour. */
export function useUpdateSupervisionAutoRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putAutoRules,
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });
}
