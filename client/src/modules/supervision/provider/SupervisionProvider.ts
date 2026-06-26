/* ============================================================
   SupervisionProvider — la « seam » du Superviseur d'agents

   Frontière unique entre l'UI et le système agent.

   - Aujourd'hui : MockSupervisionProvider (rejoue des données + flux scripté),
     pour développer tout le front sans dépendre du back.
   - Demain : un adaptateur CopilotKit/AG-UI (état partagé du graphe LangGraph)
     implémentera EXACTEMENT cette interface → l'UI ne change pas (drop-in).

   Bidirectionnel : les actions (validate/edit/autonomy/pause) ÉCRIVENT dans
   l'état du graphe ; le flux d'events met l'UI à jour. L'opérateur est DANS
   la boucle, pas spectateur.
   ============================================================ */

import type { AgentId, AutonomyLevel, StreamEvent, SupervisionSnapshot } from '../types';

export interface SupervisionProvider<TSnapshot extends SupervisionSnapshot = SupervisionSnapshot> {
  /**
   * Lit le snapshot courant (au chargement, le ciel « s'allume » pendant l'attente).
   * Rejette en cas d'échec → le consommateur affiche l'état hors-ligne.
   */
  getSnapshot(): Promise<TSnapshot>;

  /**
   * S'abonne au flux temps réel. Retourne une fonction de désabonnement.
   * Perte de flux → event `{ type: 'connection', online: false }` ;
   * reprise → `{ type: 'connection', online: true }` (le consommateur re-`getSnapshot`).
   */
  subscribe(listener: (event: StreamEvent) => void): () => void;

  /** Valide une action de la file → reprend le graphe ; l'agent passe wait → act. */
  validatePending(actionId: string): Promise<void>;

  /** Modifie une action → ouvre l'éditeur métier concerné (résolu hors seam). */
  editPending(actionId: string): Promise<void>;

  /** Autonomie globale (s'applique à tous les agents). */
  setGlobalAutonomy(level: AutonomyLevel): Promise<void>;

  /** Autonomie d'un agent (change son rayon d'orbite). */
  setAgentAutonomy(agentId: AgentId, level: AutonomyLevel): Promise<void>;

  /** Pause / reprise — kill-switch : suspend réellement l'exécution côté graphe. */
  setPaused(paused: boolean): Promise<void>;

  /**
   * Déclenche un run du moteur multi-agent à partir d'un message opérateur
   * (chemin live 4d). Émet immédiatement le tour opérateur, puis traduit
   * l'activité reçue en StreamEvents (la constellation réagit) et accumule la
   * réponse texte de l'orchestrateur via les events `conversation.*`.
   *
   * Optionnel : le mock ne déclenche aucun run réel (la barre de chat n'est
   * affichée qu'en mode live). Absent ⇒ pas de chemin de déclenchement.
   */
  kickoff?(message: string): Promise<void>;

  /**
   * Tranche une action sensible en attente (interrupt) affichée inline :
   * `true` = valider (reprend le run, l'outil s'exécute), `false` = refuser
   * (le run reprend, l'outil est abandonné). Reprend le flux SSE.
   *
   * Optionnel : seul le provider AG-UI réel met des runs en pause. Le mock ne
   * déclenche aucun interrupt → méthode absente (no-op côté hook).
   */
  resolvePendingAction?(confirmed: boolean): Promise<void>;

  /** Libère les ressources (timers, sockets, abonnements). */
  dispose(): void;
}
