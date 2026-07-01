/* ============================================================
   Config org-level de la constellation Superviseur (Settings > IA)

   Lit/écrit GET|PUT /api/ai/supervision/config. Source de vérité = backend
   (SupervisionConfigController). Utilisé par :
     - la section Settings > IA (master + modules + autonomie),
     - le gating du panneau Planning (n'affiche la constellation que si activée).
   ============================================================ */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';
import type { AutonomyLevel } from './types';

/** Config d'un module (agent) du catalogue, telle qu'exposée par le backend. */
export interface SupervisionModuleConfig {
  key: string;
  /** Clé i18n du libellé (le rendu reste côté front). */
  labelKey: string;
  enabled: boolean;
  autonomy: AutonomyLevel;
  builtin: boolean;
}

export interface SupervisionConfig {
  enabled: boolean;
  paused: boolean;
  /** Plafond : nb max de scans automatiques / jour / org (0 = auto désactivé). */
  dailyScanBudget: number;
  modules: SupervisionModuleConfig[];
}

const QUERY_KEY = ['supervision', 'config'] as const;

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchConfig(): Promise<SupervisionConfig> {
  const response = await fetch(buildApiUrl('/ai/supervision/config'), {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json', ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(`supervision config fetch failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionConfig;
}

async function putConfig(config: SupervisionConfig): Promise<SupervisionConfig> {
  const response = await fetch(buildApiUrl('/ai/supervision/config'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error(`supervision config update failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionConfig;
}

/**
 * Lit la config de supervision de l'org. `enabled` (param) gate la requête :
 * on ne fetch pas pour un user sans droit de supervision.
 */
export function useSupervisionConfig(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchConfig,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

/** Bilan d'un scan manuel (cf. SupervisionScanResultDto). */
export interface SupervisionScanResult {
  status: 'ok' | 'disabled' | 'paused' | string;
  activities: number;
  suggestions: number;
  reply: string;
}

/**
 * Lance un scan manuel d'une propriété (revue proactive multi-agent). Synchrone
 * côté serveur (LLM) — l'appelant gère son propre état de chargement.
 */
export async function runSupervisionScan(
  propertyId: string | number,
): Promise<SupervisionScanResult> {
  const response = await fetch(buildApiUrl(`/ai/supervision/scan/${propertyId}`), {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json', ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error(`supervision scan failed: ${response.status}`);
  }
  return (await response.json()) as SupervisionScanResult;
}

/** Met à jour la config (master + modules) ; rafraîchit le cache au succès. */
export function useUpdateSupervisionConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putConfig,
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });
}
