/* ============================================================
   ConstellationRenderer — interface de rendu SWAPPABLE

   Le cœur (données/état/HITL) ne dépend QUE de cette interface.
   Le 1er renderer = FramerConstellation (framer-motion + SVG/DOM).
   Si le design évolue ou change, on remplace le renderer sans
   toucher au reste (décision d'archi : design non figé).

   Le renderer est purement présentationnel : il reçoit une vue
   normalisée (déjà agrégée pour le portefeuille) + des callbacks.
   ============================================================ */

import type { ComponentType, ReactNode } from 'react';
import type { AgentId, AgentStatus, AutonomyLevel, PendingAction } from '../types';

export interface ConstellationAgentView {
  id: AgentId;
  status: AgentStatus;
  autonomy: AutonomyLevel; // → rayon d'orbite
  task: string | null; // langage métier (tooltip)
  thinkingProgress?: number; // 0–100, halo « Réfléchit » (status === 'think')
  badge?: number; // portefeuille : nb de logements concernés
  /** Nb d'actions de la file HITL portées par cet agent — libellé « N en
   *  attente » sous le nœud (OrbitConstellation). Optionnel : les renderers
   *  qui ne l'affichent pas l'ignorent. */
  pendingCount?: number;
}

export interface ConstellationHud {
  agentsCount: number;
  actingCount: number;
  awaitingCount: number;
}

/**
 * Bilan de valeur affiché dans le HUD (« Orchestrateur »). Fenêtre alignée sur
 * le zoom du planning (Semaine 7 / Quinzaine 15 / Mois 30 j).
 */
export interface ConstellationReport {
  windowDays: number;
  autoActions: number;
  acceptanceRate: number; // 0..1
  estimatedTimeSaved: string; // « ≈ 7 h 20 »
}

export interface ConstellationRendererProps {
  agents: ConstellationAgentView[];
  hud: ConstellationHud;
  online: boolean; // false → ciel terni (Phase 3)
  paused: boolean; // kill-switch (Phase 3/4)
  focused: boolean; // mode focus (clic cœur)
  onToggleFocus: () => void;
  onSelectAgent?: (id: AgentId) => void;
  /** Action posée DANS le HUD (haut-gauche), ex. bouton « Scanner » en icône. */
  headerAction?: ReactNode;
  /** Bilan de valeur (fenêtre = zoom planning) affiché dans le HUD. */
  report?: ConstellationReport;
  /** Fenêtre du bilan actuellement sélectionnée (jours) — état du sélecteur. */
  reportWindow?: number;
  /** Change la fenêtre du bilan depuis le HUD (Jour/Semaine/Quinzaine/Mois). */
  onReportWindowChange?: (days: number) => void;
  /** Contenu empilé JUSTE SOUS le HUD (haut-gauche), ex. flux « En direct ». */
  belowHud?: ReactNode;
  /**
   * Mode COMPACT (conteneur étroit, mesuré par le parent) : les surcouches
   * (HUD, belowHud, hitl) se replient en rail de pastilles + tiroir bas — la
   * constellation reste dégagée. Défaut : présentation étalée (desktop).
   */
  compact?: boolean;
  /** File HITL (cartes « à valider ») affichée dans le tiroir du mode compact. */
  hitl?: ReactNode;
  /** Nb d'actions en attente — badge de la pastille « À traiter ». */
  hitlCount?: number;
  /**
   * Rendu pleine-cellule (accordéon Planning) : le canvas couvre TOUT le parent,
   * sans coins arrondis ni ombre portée — aucun espace vide autour. Défaut :
   * carte arrondie (vues standalone / portefeuille).
   */
  flush?: boolean;
  /**
   * Annonce l'agent arrivé à l'emplacement de tête, une fois sa rotation
   * TERMINÉE (`null` pendant la rotation, hors-ligne ou en pause). Le panneau
   * s'en sert pour dessiner les attaches vers les cartes HITL de cet agent —
   * mesurées quand les positions sont stables. Optionnel : les renderers sans
   * emplacement de tête (FramerConstellation) l'ignorent.
   */
  onHeadAgentSettled?: (id: AgentId | null) => void;
  /**
   * File HITL brute — alimente l'infobulle RICHE des nœuds (aperçu borné des
   * actions en attente de l'agent + échéances, cf. OrbitDiagram). Optionnel :
   * sans elle, l'infobulle retombe sur la tâche en cours / le rôle.
   */
  pendingItems?: readonly PendingAction[];
}

export type ConstellationRenderer = ComponentType<ConstellationRendererProps>;
