/* ============================================================
   supervisionConfigApi — lecture/écriture de l'autonomie via /config

   Le contrôle d'autonomie de la constellation (setGlobalAutonomy /
   setAgentAutonomy) est persisté dans la config org existante
   (GET|PUT /api/ai/supervision/config, module_key = agentId).
   ============================================================ */

import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import type { AgentId, AutonomyLevel } from '../types';

interface ModuleConfig {
  key: string;
  labelKey?: string;
  enabled: boolean;
  autonomy: AutonomyLevel;
  builtin?: boolean;
}
interface SupervisionConfig {
  enabled: boolean;
  paused: boolean;
  dailyScanBudget: number;
  modules: ModuleConfig[];
}

function authHeaders(withJson = false): HeadersInit {
  const token = getAccessToken();
  return {
    accept: 'application/json',
    ...(withJson ? { 'content-type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function getConfig(): Promise<SupervisionConfig | null> {
  try {
    const res = await fetch(buildApiUrl('/ai/supervision/config'), {
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as SupervisionConfig;
  } catch {
    return null;
  }
}

/**
 * Applique un niveau d'autonomie : `'all'` → tous les agents, sinon l'agent ciblé.
 * Best-effort : renvoie true si persisté (PUT ok), false sinon (l'appelant garde l'état).
 */
export async function applyAutonomy(target: AgentId | 'all', level: AutonomyLevel): Promise<boolean> {
  const config = await getConfig();
  if (!config) return false;
  const modules = config.modules.map((m) =>
    target === 'all' || m.key === target ? { ...m, autonomy: level } : m,
  );
  try {
    const res = await fetch(buildApiUrl('/ai/supervision/config'), {
      method: 'PUT',
      credentials: 'include',
      headers: authHeaders(true),
      body: JSON.stringify({ ...config, modules }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Autonomie réelle courante : globale (commune si homogène, sinon 'suggest') + par agent. */
export async function fetchAutonomy(): Promise<{
  global: AutonomyLevel;
  byAgent: Record<string, AutonomyLevel>;
} | null> {
  const config = await getConfig();
  if (!config) return null;
  const byAgent: Record<string, AutonomyLevel> = {};
  for (const m of config.modules) byAgent[m.key] = m.autonomy;
  const levels = new Set(Object.values(byAgent));
  const global: AutonomyLevel = levels.size === 1 ? [...levels][0] : 'suggest';
  return { global, byAgent };
}
