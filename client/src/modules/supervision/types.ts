/* ============================================================
   Superviseur d'agents IA — contrat de données (front)

   Formes alignées sur handoff_superviseur_agents/data-contract.md.
   La source de vérité runtime est l'état partagé du système agent
   (LangGraph + CopilotKit/AG-UI). Le front ne fait que lire/écrire
   cet état via la SupervisionProvider seam (cf. ./provider).

   Garde-fou : aucun de ces champs ne porte de jargon technique
   (nœud/arête/interrupt/checkpoint/state/token/prompt/modèle).
   ============================================================ */

// ─── Identités & énumérations ────────────────────────────────────────────────

export type AgentId = 'com' | 'rev' | 'ops' | 'fin' | 'rep';

export type AgentStatus =
  | 'veille' // En veille
  | 'think' // Réfléchit (traitement en cours, 5–15 s)
  | 'act' // Agit
  | 'wait' // Attend ta validation (action dans la file persistante)
  | 'esc' // Escaladé (besoin humain hors validation simple)
  | 'err'; // Erreur

export type AutonomyLevel = 'suggest' | 'notify' | 'full';
// suggest = Suggérer (propose, l'humain décide)
// notify  = Agir puis notifier (agit puis informe)  ← défaut
// full    = Auto (pleine autonomie)

// ─── Métriques d'agent (drawer détail) ───────────────────────────────────────

export interface AgentMetric {
  label: string;
  value: string;
}

// ─── Agent (état courant, scopé à UN logement) ───────────────────────────────

export interface Agent {
  id: AgentId;
  status: AgentStatus;
  autonomy: AutonomyLevel; // → rayon d'orbite
  task: string | null; // tâche en cours, langage métier ("Répond à un message Airbnb")
  thinkingProgress?: number; // 0–100, uniquement si status === 'think'
  reservationId?: string | null; // objet métier concerné → cible de la comète / surbrillance planning
  metrics: AgentMetric[];
}

// ─── File persistante « Attend ta validation » ───────────────────────────────
// Survit au refresh, multi-appareils, peut expirer. Ce n'est pas un badge éphémère.

export interface PendingAction {
  id: string;
  agentId: AgentId;
  title: string; // "Baisser le tarif du 20–22 juil. de −12 %"
  motif: string; // court ("Faible demande détectée sur ce créneau")
  reasoning: string; // "Pourquoi ?" — langage métier, nettoyé côté serveur (jamais de jargon LLM)
  reservationId?: string | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO — l'action peut expirer
  /**
   * Type de carte. Absent/'action' = action à valider (défaut). 'reminder' =
   * rappel informatif (ex. reversement J-1) : « Info reçue » / « Ne plus afficher ».
   * 'payment' = interventions impayées à régler : « Régler » (ouvre Stripe) / « Plus tard ».
   * Ni 'reminder' ni 'payment' n'ont de minuteur d'expiration.
   */
  kind?: 'action' | 'reminder' | 'payment';
  /**
   * Famille d'une carte 'payment' (demande de service) : 'maintenance' → le
   * libellé affiché est préfixé « Maintenance … » (traduit via i18n au rendu),
   * 'cleaning' → titre brut (porte déjà « Ménage … »).
   */
  serviceCategory?: 'cleaning' | 'maintenance';
  /**
   * Montant BRUT en EUR (devise de base), pour les cartes 'payment' ET pour
   * l'impact estimé d'une suggestion actionnable. Formaté dans la devise choisie
   * par l'opérateur au rendu (cf. PendingActionCard + useCurrency), puis affiché
   * directement DANS le bouton d'action.
   */
  amountEur?: number;
  /**
   * Type d'action exécutable (ex. {@code PRICE_DROP}) pour une suggestion
   * actionnable : la carte affiche « Appliquer » (au lieu de « Valider ») et la
   * validation déclenche l'exécution serveur ({@code POST /suggestions/{id}/apply}).
   * Absent = suggestion informationnelle (Valider = rejet, comportement historique).
   */
  applyActionType?: string;
  /**
   * Paramètres bruts de l'action (JSON, ex. {@code {"segments":[{from,to,percent}, …]}}),
   * pour préremplir la modale d'ajustement de prix. Absent si non actionnable.
   */
  actionParams?: string;
  /**
   * Carte informationnelle « email voyageur manquant » (scanner backend
   * {@code guest_email_missing}) : le CTA n'exécute AUCUNE action serveur — il ouvre,
   * côté front, le modal de fiche client (GuestCardDialog) pour compléter l'email.
   * Nécessite un `reservationId` pour cibler la réservation. Jamais d'`/apply`.
   */
  opensGuestCard?: boolean;
}

// ─── Approbation inline (interrupt AG-UI, chemin live) ───────────────────────
// Quand un agent veut exécuter une action sensible, le moteur met le run en
// PAUSE (RUN_FINISHED outcome=interrupt). Le front affiche une carte
// d'approbation inline ; la décision opérateur reprend le run (resume). C'est
// éphémère (lié au run courant), distinct de la file persistante PendingAction.

export interface PendingAgentAction {
  /** Identifiant de l'interrupt à reprendre (passé tel quel dans `resume`). */
  interruptId: string;
  /** Nom métier de l'outil en attente (langage humain, déjà nettoyé). */
  toolName: string;
  /** Message d'explication remonté par l'agent ("Confirmer l'envoi du message ?"). */
  message: string;
  /** Arguments de l'outil (affichage informatif optionnel). */
  args?: Record<string, unknown>;
}

// ─── Journal « en direct » (chrono inversé) ──────────────────────────────────

export interface FeedEntry {
  id: string;
  agentId: AgentId;
  at: string; // ISO (affiché HH:MM)
  text: string; // libellé de repli (résumé porté par l'outil, ou mock)
  /** Nom stable de l'outil → clé i18n `supervision.tools.<toolName>` (feed réel). */
  toolName?: string;
  /**
   * Id du message envoyé (GuestMessageLog) lié à cette entrée — présent uniquement pour
   * les envois de message guest (ex. « Message de check-out »). Quand présent, la ligne
   * est cliquable et ouvre une modale prévisualisant le contenu envoyé
   * (GET /api/guest-messaging/preview/{messageLogId}).
   */
  messageLogId?: number;
  /**
   * Id de la facture liée à cette entrée — présent uniquement pour les relances
   * de paiement (agent Finance). Quand présent, la ligne est cliquable et ouvre
   * la modale de détail facture (payer / envoyer un lien de paiement).
   */
  invoiceId?: number;
  /**
   * Entrée issue de l'orchestrateur (réponse à une demande opérateur dans le
   * chat), pas d'un agent métier : rendu avec l'identité orchestrateur (icône +
   * couleur d'accent) au lieu de `AGENT_META[agentId]`.
   */
  orchestrator?: boolean;
}

// ─── Métriques du jour (en-tête) ─────────────────────────────────────────────

export interface DayMetrics {
  timeSaved: string;
  autoActions: number;
  awaiting: number;
}

// ─── Snapshot par logement ───────────────────────────────────────────────────

export interface OrchestratorSnapshot {
  scope: 'property';
  propertyId: string;
  online: boolean; // false → état hors-ligne (ciel terni)
  summary: string; // "Coordonne 5 agents · 1 action attend ta validation"
  globalAutonomy: AutonomyLevel;
  paused: boolean;
  agents: Agent[]; // les 5
  pending: PendingAction[];
  feed: FeedEntry[];
  dayMetrics: DayMetrics;
  /**
   * Conversation opérateur ⇄ orchestrateur (chemin live 4d). Quand l'opérateur
   * envoie un message via la barre de chat du panneau, il déclenche un run du
   * moteur multi-agent : la constellation réagit (agentActivity → events) ET la
   * réponse texte de l'orchestrateur s'accumule ici. Vide en mock par défaut.
   */
  conversation?: ConversationTurn[];
  /** true tant qu'un run déclenché par l'opérateur est en cours (réponse en streaming). */
  conversationBusy?: boolean;
  /**
   * Action sensible en attente d'approbation opérateur (interrupt AG-UI). Quand
   * présente, le panneau affiche une carte Valider / Refuser inline. La décision
   * reprend le run. Effacée dès qu'un nouveau run reprend (resume). Vide en mock.
   */
  pendingAction?: PendingAgentAction;
}

// ─── Conversation opérateur ⇄ orchestrateur (chemin live) ─────────────────────

export interface ConversationTurn {
  id: string;
  role: 'operator' | 'orchestrator';
  text: string;
  at: string; // ISO
}

// ─── Agrégat portefeuille ────────────────────────────────────────────────────

export interface PortfolioAgentItem {
  propertyId: string;
  propertyName: string;
  status: AgentStatus;
  task: string;
}

export interface PortfolioAgentRollup {
  id: AgentId;
  status: AgentStatus; // statut le plus prioritaire sur le parc (wait > act > think > veille)
  autonomy: AutonomyLevel; // défaut global de l'agent → rayon d'orbite
  propertyCount: number; // nb de logements où l'agent est actif/en attente → BADGE du satellite
  task: string; // synthèse ("3 ajustements de prix attendent ta validation")
  items: PortfolioAgentItem[]; // ventilation (tooltip + drawer)
}

export interface PortfolioPendingAction extends PendingAction {
  propertyId: string;
  propertyName: string; // affiché sur chaque carte de la file ("Duplex Marais")
}

export interface PortfolioFeedEntry extends FeedEntry {
  propertyName: string;
}

/** Alerte de niveau PORTEFEUILLE (org) — indicateur global non rattaché à un logement. */
export interface OrgAlert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
}

export interface PortfolioSnapshot {
  scope: 'portfolio';
  propertyCount: number; // N logements pilotés
  online: boolean;
  globalAutonomy: AutonomyLevel;
  paused: boolean;
  agents: PortfolioAgentRollup[]; // les 5, agrégés
  pending: PortfolioPendingAction[]; // TOUTES les actions en attente, tous logements
  feed: PortfolioFeedEntry[]; // journal portefeuille
  dayMetrics: DayMetrics;
  /** Alertes org-level (occupation/marge/nuits vacantes du parc). Optionnel (mock/legacy). */
  orgAlerts?: OrgAlert[];
}

export type SupervisionSnapshot = OrchestratorSnapshot | PortfolioSnapshot;

// ─── Flux temps réel ─────────────────────────────────────────────────────────
// Chaque event = un événement réel de la stack agent. Rien de décoratif.

export type StreamEvent =
  | {
      type: 'agent.status';
      agentId: AgentId;
      status: AgentStatus;
      task?: string;
      thinkingProgress?: number;
      reservationId?: string | null;
    }
  | { type: 'agent.acting'; agentId: AgentId; reservationId: string } // → déclenche la comète
  | { type: 'pending.added'; action: PendingAction | PortfolioPendingAction }
  | { type: 'pending.resolved'; actionId: string; outcome: PendingOutcome; by?: string } // `by` = autre opérateur (concurrence)
  | { type: 'feed.added'; entry: FeedEntry | PortfolioFeedEntry }
  | { type: 'connection'; online: boolean } // → bascule hors-ligne / en direct
  // ── Conversation opérateur ⇄ orchestrateur (chemin live 4d) ──────────────────
  | { type: 'conversation.message'; turn: ConversationTurn } // tour complet (opérateur OU orchestrateur)
  | { type: 'conversation.delta'; id: string; delta: string } // fragment de réponse orchestrateur (streaming)
  | { type: 'conversation.busy'; busy: boolean } // run en cours (true) / terminé (false)
  // ── Approbation inline (interrupt AG-UI) ─────────────────────────────────────
  | { type: 'pendingAction.added'; action: PendingAgentAction } // run en pause : action sensible à valider/refuser
  | { type: 'pendingAction.cleared' } // décision prise (ou run repris) → carte retirée
  // ── Rafraîchissement périodique hors run (polling du feed/file réels) ─────────
  | { type: 'snapshot.refreshed'; snapshot: SupervisionSnapshot }; // remplace feed/pending/agents/métriques (property OU portefeuille), préserve l'état live

export type PendingOutcome = 'validated' | 'edited' | 'expired';
