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
import type { AgentId, AgentStatus, AutonomyLevel } from '../types';

export interface ConstellationAgentView {
  id: AgentId;
  status: AgentStatus;
  autonomy: AutonomyLevel; // → rayon d'orbite
  task: string | null; // langage métier (tooltip)
  thinkingProgress?: number; // 0–100, halo « Réfléchit » (status === 'think')
  badge?: number; // portefeuille : nb de logements concernés
}

export interface ConstellationHud {
  agentsCount: number;
  actingCount: number;
  awaitingCount: number;
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
  /** Contenu empilé JUSTE SOUS le HUD (haut-gauche), ex. flux « En direct ». */
  belowHud?: ReactNode;
}

export type ConstellationRenderer = ComponentType<ConstellationRendererProps>;
