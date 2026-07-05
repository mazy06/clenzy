/* ============================================================
   Superviseur d'agents IA — constantes & métadonnées

   Données pures (pas de JSX) → testables et réutilisables par le
   cœur headless comme par le renderer. Les libellés sont des CLÉS
   i18n (jamais de chaîne en dur) ; le rendu en composant lucide-react
   est fait par le renderer (Phase 2).
   ============================================================ */

import type { AgentId, AgentStatus, AutonomyLevel } from './types';

// ─── Métadonnées agents ──────────────────────────────────────────────────────
// `color` = couleur de domaine (handoff §2). Les dégradés sont une affaire de rendu.
// `icon`  = jeton sémantique → mappé sur lucide-react dans le renderer.

export type AgentIconToken = 'chat' | 'trend-up' | 'broom' | 'bank' | 'star';

export interface AgentMeta {
  id: AgentId;
  color: string;
  icon: AgentIconToken;
  nameKey: string;
  roleKey: string;
}

export const AGENT_META: Record<AgentId, AgentMeta> = {
  com: { id: 'com', color: '#3B6FE0', icon: 'chat', nameKey: 'supervision.agents.com.name', roleKey: 'supervision.agents.com.role' },
  rev: { id: 'rev', color: '#7C5CE0', icon: 'trend-up', nameKey: 'supervision.agents.rev.name', roleKey: 'supervision.agents.rev.role' },
  ops: { id: 'ops', color: '#1F9E8D', icon: 'broom', nameKey: 'supervision.agents.ops.name', roleKey: 'supervision.agents.ops.role' },
  fin: { id: 'fin', color: '#C77D2E', icon: 'bank', nameKey: 'supervision.agents.fin.name', roleKey: 'supervision.agents.fin.role' },
  rep: { id: 'rep', color: '#D6457E', icon: 'star', nameKey: 'supervision.agents.rep.name', roleKey: 'supervision.agents.rep.role' },
};

/** Ordre canonique des satellites (réparti par layoutConstellation). */
export const AGENT_IDS: AgentId[] = ['com', 'rev', 'ops', 'fin', 'rep'];

// ─── Statuts (couleur + libellé) ─────────────────────────────────────────────

export interface StatusMeta {
  labelKey: string;
  color: string;
  /** un agent « actif » est relié au cœur par un faisceau (cf. drawBeams). */
  active: boolean;
}

export const STATUS: Record<AgentStatus, StatusMeta> = {
  veille: { labelKey: 'supervision.status.veille', color: '#6B7196', active: false },
  think: { labelKey: 'supervision.status.think', color: '#9B9BF0', active: true },
  act: { labelKey: 'supervision.status.act', color: '#37D98A', active: true },
  wait: { labelKey: 'supervision.status.wait', color: '#F0B24B', active: true },
  esc: { labelKey: 'supervision.status.esc', color: '#FF5A5F', active: true },
  err: { labelKey: 'supervision.status.err', color: '#DC2626', active: true },
};

/** Statuts « au travail » reliés par un faisceau de délégation (act/think/wait). */
export const ACTIVE_STATUSES: readonly AgentStatus[] = ['act', 'think', 'wait'];

export function isActiveStatus(status: AgentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Statuts reliés au cœur (tout sauf la veille). Un agent escaladé/en erreur
 * reste relié et mis en avant (il demande de l'attention) — pas atténué.
 */
export function isConnectedStatus(status: AgentStatus): boolean {
  return status !== 'veille';
}

// ─── Priorité d'agrégation portefeuille ──────────────────────────────────────
// Handoff : wait > act > think > veille. esc/err placés au-dessus (plus urgents).

export const STATUS_PRIORITY: Record<AgentStatus, number> = {
  err: 5,
  esc: 4,
  wait: 3,
  act: 2,
  think: 1,
  veille: 0,
};

/** Statut le plus prioritaire d'un ensemble (rollup portefeuille). Vide → 'veille'. */
export function maxPriorityStatus(statuses: readonly AgentStatus[]): AgentStatus {
  return statuses.reduce<AgentStatus>(
    (best, s) => (STATUS_PRIORITY[s] > STATUS_PRIORITY[best] ? s : best),
    'veille',
  );
}

// ─── Autonomie ───────────────────────────────────────────────────────────────

export const AUTO_LABEL: Record<AutonomyLevel, string> = {
  suggest: 'supervision.autonomy.suggest',
  notify: 'supervision.autonomy.notify',
  full: 'supervision.autonomy.full',
};

export const DEFAULT_AUTONOMY: AutonomyLevel = 'notify';

/**
 * Rayon d'orbite normalisé (× R) par niveau d'autonomie.
 * `r = R · RAD[autonomie]` : l'orbite reflète TOUJOURS l'autonomie (le statut
 * `wait` ne déplace plus l'agent — il est signalé par la couleur/HUD/carte).
 * AUTO proche du centre, NOTIFIE au milieu, SUGGÈRE loin.
 */
export const RAD: Record<AutonomyLevel, number> = {
  full: 0.4,
  notify: 0.585,
  suggest: 0.77,
};
