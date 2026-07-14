/* ============================================================
   Règles d'auto-application par type (Vagues 1-2 autonomie constellation)

   Lit/écrit GET|PUT /api/ai/supervision/auto-rules. Source de vérité =
   backend (SupervisionConfigController). Catalogue fixé côté serveur
   (V1 : CLEANING_REQUEST, REVIEW_DRAFT_REPLY, PRICE_DROP · V2 :
   CALENDAR_BLOCK, DEPOSIT_RELEASE, DEPOSIT_REFUND · V3 :
   PAYMENT_REMINDER) — défaut tout OFF. Le plafond du module
   (moduleCeiling) et le niveau MAX du type (maxLevel — « notify » pour
   cautions/blocage/relance : jamais silencieux) sont calculés serveur,
   lecture seule. V3 : les Règles de Confiance des cartes posent une
   suggestion « automatiser ? » (suggestedAt + consecutiveApprovals) que
   l'humain Active (toggle ON) ou Ignore (POST dismiss-suggestion).
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
  /** Niveau MAX du type au catalogue serveur ('notify'|'full') — lecture seule. */
  maxLevel: 'notify' | 'full';
  /** Suggestion « automatiser ce type ? » active (ISO) ou null — lecture seule (V3). */
  suggestedAt: string | null;
  /** Approbations humaines consécutives (chip « Recommandé ») — lecture seule (V3). */
  consecutiveApprovals: number;
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

async function dismissSuggestion(actionType: string): Promise<SupervisionAutoRule[]> {
  const response = await fetch(
    buildApiUrl(`/ai/supervision/auto-rules/${encodeURIComponent(actionType)}/dismiss-suggestion`),
    {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', ...authHeaders() },
    },
  );
  if (!response.ok) {
    throw new Error(`supervision auto-rule suggestion dismiss failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionAutoRule[];
}

/** « Ignorer » la suggestion d'automatisation d'un type (cooldown 30 j côté serveur). */
export function useDismissAutoRuleSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissSuggestion,
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });
}
