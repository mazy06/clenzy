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
 *
 * La PLEINE autonomie ne passe PAS par ce PUT (le serveur l'y refuse sans
 * acceptation tracée) : elle est routée vers l'endpoint de consentement, qui
 * enregistre qui accepte, quand et sur quel texte. En masse (`'all'`), elle est
 * refusée tout court — on n'engage pas la responsabilité de l'organisation sur
 * dix agents d'un seul clic.
 */
export async function applyAutonomy(target: AgentId | 'all', level: AutonomyLevel): Promise<boolean> {
  if (level === 'full') {
    return target === 'all' ? false : acceptFullAutonomy(target);
  }
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

/**
 * Version du texte d'avertissement de la pleine autonomie. À INCRÉMENTER dès
 * que le texte change : une acceptation ne vaut que pour ce qui a été lu, et
 * la trace serveur conserve la version acceptée.
 */
export const FULL_AUTONOMY_NOTICE_VERSION = '2026-08-v1';

/**
 * Acceptation de la pleine autonomie d'un agent : le serveur trace l'auteur,
 * l'instant et la version du texte, PUIS applique le niveau. Passer par un PUT
 * de config ne suffit pas — le serveur y refuse FULL sans trace.
 */
export async function acceptFullAutonomy(agentId: AgentId): Promise<boolean> {
  try {
    const res = await fetch(
      buildApiUrl(`/ai/supervision/modules/${agentId}/full-autonomy-consent`),
      {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ noticeVersion: FULL_AUTONOMY_NOTICE_VERSION }),
      },
    );
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
