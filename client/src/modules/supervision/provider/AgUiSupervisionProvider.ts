/* ============================================================
   AgUiSupervisionProvider — implémentation RÉELLE de la seam

   Drop-in de {@link SupervisionProvider} branché sur l'ÉTAT RÉEL du moteur
   multi-agent Clenzy, via le pont AG-UI déjà en place (POST /api/agui/run,
   SSE). Frère du MockSupervisionProvider (qu'on NE supprime PAS) : même
   interface, même cycle de vie, donc l'UI ne change pas.

   ── Transport ─────────────────────────────────────────────────────────────
   On consomme le flux AG-UI en SSE (fetch + ReadableStream, comme
   assistantApi._postSse). On ne dépend PAS du runtime React CopilotKit du
   spike : la seam est class-based, pas hook-based. On parle directement à
   l'endpoint Java AgUiController.

   ── Ce qu'on lit ──────────────────────────────────────────────────────────
   Le backend émet l'activité agent dans des frames AG-UI STATE_SNAPSHOT :
     { type: "STATE_SNAPSHOT", snapshot: { agentActivity: { specialist, phase,
       toolName?, task? } } }
   On traduit chaque agentActivity en StreamEvent constellation via le mapping
   specialist→agent (specialistMapping.ts), puis applyStreamEvent fait le reste.

   ── Déclenchement d'un run ──────────────────────────────────────────────────
   La constellation est un OBSERVATEUR : par défaut, elle n'envoie pas de
   message. Un run est déclenché soit par l'opérateur (chat fusionné — 4d),
   soit par un `kickoff` optionnel passé en option (utile pour démos /
   intégration). Sans run actif, la constellation reste « en direct » mais au
   repos (tous les agents en veille).
   ============================================================ */

import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { applyAutonomy, fetchAutonomy } from './supervisionConfigApi';
import type { AgentId, AutonomyLevel, OrchestratorSnapshot, PendingAction, PendingAgentAction, StreamEvent } from '../types';
import type { SupervisionProvider } from './SupervisionProvider';
import { buildPropertySnapshot } from './mockData';
import { mapSpecialistToAgent } from './specialistMapping';

type Listener = (event: StreamEvent) => void;

/** Forme (côté front) de l'activité agent émise par le backend dans STATE_SNAPSHOT. */
interface AgentActivityPayload {
  specialist?: string;
  phase?: 'started' | 'thinking' | 'acting' | 'done' | string;
  toolName?: string;
  task?: string;
}

/** Décision d'approbation envoyée au backend dans `resume` (racine du body). */
interface ResumePayload {
  interruptId: string;
  status: 'resolved' | 'cancelled';
  payload: { confirmed: boolean };
}

/** Interrupt remonté dans RUN_FINISHED.outcome (contrat backend HITL, flux live). */
interface AgUiInterrupt {
  id: string;
  reason?: string;
  message?: string;
  toolCallId?: string;
  metadata?: { toolName?: string; args?: Record<string, unknown> };
}

/**
 * Forme RÉELLE renvoyée par `GET /api/agui/pending` (cf. PendingActionDto.java).
 * Distincte d'{@link AgUiInterrupt} (flux live) : ici la clé de reprise est
 * `toolCallId` et le détail tient dans `description` / `argsSummary`.
 */
interface PendingActionDtoShape {
  toolCallId: string;
  toolName?: string;
  description?: string;
  argsSummary?: string;
  conversationId?: number;
  createdAt?: string;
  /** Specialist backend (ex. `data_analyst`) → mappé vers l'agent constellation. */
  specialistName?: string;
}

/** Réponse de GET /api/ai/supervision/activity/{id} (feed + métriques réels). */
interface ActivitySnapshotShape {
  feed: Array<{ id: string; agentId: string; at: string; text: string; toolName?: string }>;
  autoActions: number;
}

/** Suggestion org-scopée (GET /api/ai/supervision/suggestions/{id}). */
interface SuggestionShape {
  id: string;
  agentId: string;
  title: string;
  motif?: string;
  reservationId?: number | null;
  createdAt: string;
  expiresAt?: string;
  /** Type d'action exécutable (ex. PRICE_DROP), ou absent = informationnelle. */
  actionType?: string | null;
  /** Impact estimé en centimes EUR (optionnel). */
  estimatedImpactCents?: number | null;
  /** Gravité indicative (info/warning/critical), optionnel. */
  severity?: string | null;
}

/** Rappel J-1 de reversement (GET /api/ai/supervision/payout-reminder, cf. PayoutReminderDto). */
interface PayoutReminderShape {
  id: string;
  title: string;
  motif: string;
  reasoning: string;
  payoutDate: string; // ISO date (YYYY-MM-DD)
}

/** Préfixe d'id qui distingue une carte de rappel payout d'une suggestion de scan. */
const PAYOUT_REMINDER_PREFIX = 'payout-reminder';

/** Carte « demande de service impayée » (GET /api/ai/supervision/unpaid-service-requests/{id}). */
interface UnpaidSrCardShape {
  id: string;
  serviceRequestId: number;
  /** Titre BRUT de la demande (donnée). Le préfixe traduit est ajouté au rendu. */
  title: string;
  /** Famille : "cleaning" | "maintenance" → préfixe i18n côté composant. */
  category?: string;
  amount: number;
}

/** Préfixe d'id d'une carte de paiement de demande de service. */
const SERVICE_REQUEST_PREFIX = 'service-request';

export interface AgUiProviderOptions {
  /**
   * Si fourni, déclenche un run multi-agent dès la 1re souscription (ex. pour
   * une démo ou un quickstart). En usage normal, le run est déclenché par le
   * chat de l'opérateur (fusion 4d) → laisser undefined = observation passive.
   */
  kickoffMessage?: string;
  /** Page courante transmise au backend (contexte UI). */
  currentPage?: string;
  /** Propriété sélectionnée transmise au backend (contexte UI). */
  selectedPropertyId?: number;
}

/** Agent AG-UI exposé par le backend (cf. AgUiController.AGENT_NAME). */
const AGENT_NAME = 'clenzy-supervisor';

/**
 * Intervalle de rafraîchissement périodique du snapshot HORS run live (ms) : le feed
 * réel et la file HITL sont re-fetchés pour faire apparaître les nouveaux événements
 * sans recharger la page. Suspendu pendant un run SSE (le flux gère alors l'état).
 */
const POLL_INTERVAL_MS = 30_000;

export class AgUiSupervisionProvider implements SupervisionProvider<OrchestratorSnapshot> {
  private readonly listeners = new Set<Listener>();
  private abort: AbortController | null = null;
  private disposed = false;
  private runStarted = false;
  /** id du tour orchestrateur en cours (un par run) → accumulation des deltas texte. */
  private currentReplyId: string | null = null;
  /** Texte de la réponse orchestrateur en cours d'accumulation (pour le journal « En direct »). */
  private replyBuffer = '';
  /** Dernier message opérateur (B7) : persisté avec la réponse à la fin du run. */
  private lastOperatorMessage = '';
  /**
   * Historique de messages du fil courant (RunAgentInput.messages). On le
   * conserve pour pouvoir REPRENDRE le run après une pause (interrupt) avec le
   * même contexte. Le message d'origine y reste tant que le fil est actif.
   */
  private threadMessages: Array<{ role: string; content: string }> = [];
  /** Interrupt courant en attente d'approbation opérateur (null si aucun). */
  private currentInterruptId: string | null = null;
  /** Dernier runId reçu du backend (RUN_STARTED), renvoyé tel quel au resume. */
  private currentRunId: string | null = null;
  /**
   * Ids des suggestions ACTIONNABLES de la file courante (actionType présent).
   * « Valider » sur ces cartes = appliquer l'action serveur, pas rejeter.
   */
  private readonly applicableSuggestionIds = new Set<string>();
  /** true tant qu'un run SSE est en cours → le polling se met en pause pour ne pas
   *  écraser l'état live (conversation, interrupt inline). */
  private runActive = false;
  /** Timer de rafraîchissement périodique du feed/file hors run. */
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** true si un rafraîchissement est déjà en vol (évite le chevauchement). */
  private polling = false;

  constructor(
    private readonly propertyId: string,
    private readonly options: AgUiProviderOptions = {},
  ) {}

  /**
   * Snapshot initial : constellation « en direct » au repos. On part du roster
   * statique (5 agents) puis on reflète l'état RÉEL :
   *  - métriques honnêtes (PAS les valeurs mock du builder) : `awaiting` = nb
   *    d'actions en attente, `autoActions`/`timeSaved` neutres tant que la
   *    persistance d'activité (Phase 3) n'alimente pas de chiffres réels ;
   *  - agents rattachés à une action en attente → statut `wait` ;
   *  - 1re action en attente exposée en carte inline (réhydratation HITL).
   * Le reste (feed, activité) se construit ensuite par les StreamEvents du moteur.
   */
  async getSnapshot(): Promise<OrchestratorSnapshot> {
    const base = buildPropertySnapshot(this.propertyId, 'calm');
    const [hitlPending, activity, suggestions, payoutReminder, unpaidSrCards, autonomy] = await Promise.all([
      this.fetchPending(),
      this.fetchActivity(),
      this.fetchSuggestions(),
      this.fetchPayoutReminder(),
      this.fetchUnpaidServiceRequests(),
      fetchAutonomy(),
    ]);
    const inline = hitlPending[0] ? pendingDtoToAgentAction(hitlPending[0]) : null;
    if (inline) this.currentInterruptId = inline.interruptId;

    // File persistante : demandes de service impayées à régler (une carte par SR, en
    // tête, actionnable) + rappel payout J-1 + suggestions des scans autonomes.
    const pendingQueue: PendingAction[] = [];
    for (const sr of unpaidSrCards) {
      pendingQueue.push({
        id: sr.id,
        agentId: 'fin',
        // Titre BRUT + catégorie : le libellé affiché (préfixe « Maintenance »…) et
        // le raisonnement sont construits/traduits au rendu (PendingActionCard).
        title: sr.title,
        // Ne préfixe QUE si le backend indique explicitement la famille (sinon
        // undefined → titre brut). Robuste si l'image backend n'a pas encore le champ.
        serviceCategory: sr.category === 'maintenance' ? 'maintenance'
          : sr.category === 'cleaning' ? 'cleaning' : undefined,
        motif: '',
        reasoning: '',
        reservationId: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        kind: 'payment',
        // Montant BRUT en EUR → formaté dans la devise de l'opérateur au rendu
        // (PendingActionCard/useCurrency) et affiché DANS le bouton « Régler ».
        amountEur: sr.amount,
      });
    }
    if (payoutReminder) {
      pendingQueue.push({
        id: payoutReminder.id,
        agentId: 'fin',
        title: payoutReminder.title,
        motif: payoutReminder.motif,
        reasoning: payoutReminder.reasoning,
        reservationId: null,
        createdAt: new Date().toISOString(),
        expiresAt: `${payoutReminder.payoutDate}T23:59:59`,
        kind: 'reminder',
      });
    }
    this.applicableSuggestionIds.clear();
    pendingQueue.push(
      ...suggestions.map((s) => {
        // Suggestion actionnable : mémorise l'id → « Valider » = Appliquer (exécution serveur).
        if (s.actionType) this.applicableSuggestionIds.add(s.id);
        return {
          id: s.id,
          agentId: s.agentId as AgentId,
          title: s.title,
          motif: s.motif ?? '',
          reasoning: s.motif ?? '',
          reservationId: s.reservationId != null ? String(s.reservationId) : null,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt ?? s.createdAt,
          applyActionType: s.actionType ?? undefined,
          amountEur: s.estimatedImpactCents != null ? s.estimatedImpactCents / 100 : undefined,
        };
      }),
    );

    // Agents en attente : HITL (specialist) + suggestions (module).
    const waiting = new Set<AgentId>([
      ...hitlPending
        .map((dto) => mapSpecialistToAgent(dto.specialistName))
        .filter((id): id is AgentId => id !== null),
      ...pendingQueue.map((p) => p.agentId),
    ]);
    const agents = base.agents.map((a) => ({
      ...a,
      status: waiting.has(a.id) ? ('wait' as const) : ('veille' as const),
      autonomy: autonomy?.byAgent[a.id] ?? a.autonomy, // autonomie RÉELLE (config), repli mock
      task: null,
      reservationId: null,
      metrics: [], // pas de métriques mock en live ; réelles via le feed/activité
    }));

    // Feed réel (activité persistée). agentId backend = clé module = AgentId.
    // toolName = clé i18n stable (traduite au rendu ; text = repli).
    const feed = (activity?.feed ?? []).map((e) => ({
      id: e.id,
      agentId: e.agentId as AgentId,
      at: e.at,
      text: e.text,
      toolName: e.toolName,
    }));

    // Démarre (une seule fois) le rafraîchissement périodique hors run.
    this.ensurePolling();

    const awaiting = hitlPending.length + pendingQueue.length;
    return {
      ...base,
      online: true,
      paused: false,
      ...(autonomy ? { globalAutonomy: autonomy.global } : {}),
      pending: pendingQueue,
      feed,
      agents,
      dayMetrics: {
        timeSaved: '—',
        autoActions: activity?.autoActions ?? 0,
        awaiting,
      },
      summary:
        awaiting > 0
          ? `Connecté · ${awaiting} action${awaiting > 1 ? 's' : ''} attend${
              awaiting > 1 ? 'ent' : ''
            } ta validation`
          : 'Connecté au moteur multi-agent · en attente d’activité',
      ...(inline ? { pendingAction: inline } : {}),
    };
  }

  /**
   * Liste les actions en attente au montage (GET /api/agui/pending). Le backend
   * renvoie une liste de {@link PendingActionDtoShape} (forme RÉELLE, cf.
   * PendingActionDto.java) — PAS la forme `AgUiInterrupt` du flux live.
   * GRACIEUX : tout échec (endpoint absent, réseau, parse) → liste vide, jamais
   * d'erreur propagée.
   */
  private async fetchPending(): Promise<PendingActionDtoShape[]> {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl('/agui/pending'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) return [];
      const body = (await response.json()) as PendingActionDtoShape[];
      return Array.isArray(body) ? body.filter((dto) => !!dto?.toolCallId) : [];
    } catch {
      return []; // endpoint indisponible / réseau → ignoré
    }
  }

  /**
   * Feed + compteur d'actions réels de la propriété (GET /ai/supervision/activity/{id}).
   * GRACIEUX : tout échec → null (le snapshot reste lisible, feed vide).
   */
  private async fetchActivity(): Promise<ActivitySnapshotShape | null> {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl(`/ai/supervision/activity/${this.propertyId}`), {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) return null;
      return (await response.json()) as ActivitySnapshotShape;
    } catch {
      return null;
    }
  }

  /**
   * File de suggestions org-scopée (GET /ai/supervision/suggestions/{id}).
   * GRACIEUX : tout échec → liste vide.
   */
  private async fetchSuggestions(): Promise<SuggestionShape[]> {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl(`/ai/supervision/suggestions/${this.propertyId}`), {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) return [];
      const body = (await response.json()) as SuggestionShape[];
      return Array.isArray(body) ? body.filter((s) => !!s?.id) : [];
    } catch {
      return [];
    }
  }

  /**
   * Rappel J-1 de reversement (GET /ai/supervision/payout-reminder). 204 = rien à
   * afficher. GRACIEUX : tout échec → null (le snapshot reste lisible).
   */
  private async fetchPayoutReminder(): Promise<PayoutReminderShape | null> {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl('/ai/supervision/payout-reminder'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.status === 204 || !response.ok) return null;
      const body = (await response.json()) as PayoutReminderShape;
      return body?.id ? body : null;
    } catch {
      return null;
    }
  }

  /**
   * Action sur le rappel payout : 'ack' (« Info reçue ») ou 'opt-out' (« Ne plus
   * afficher »). Best-effort ; on retire la carte de la file localement dans tous les cas.
   */
  private async postReminderAction(id: string, action: 'ack' | 'opt-out'): Promise<void> {
    try {
      const token = getAccessToken();
      await fetch(buildApiUrl(`/ai/supervision/payout-reminder/${action}`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch {
      /* réseau → on retire quand même la carte localement */
    }
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId: id, outcome: 'validated' });
  }

  /**
   * Cartes déterministes des demandes de service impayées du logement
   * (GET /ai/supervision/unpaid-service-requests/{id}). GRACIEUX : tout échec → [].
   */
  private async fetchUnpaidServiceRequests(): Promise<UnpaidSrCardShape[]> {
    try {
      const token = getAccessToken();
      const response = await fetch(
        buildApiUrl(`/ai/supervision/unpaid-service-requests/${this.propertyId}`),
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!response.ok) return [];
      const body = (await response.json()) as UnpaidSrCardShape[];
      return Array.isArray(body) ? body.filter((c) => !!c?.id) : [];
    } catch {
      return [];
    }
  }

  /**
   * « Régler » : réutilise le flux de paiement existant de la demande de service
   * (POST /service-requests/{srId}/create-payment-session) et ouvre la page Stripe
   * dans un nouvel onglet. Retire ensuite la carte de la file.
   */
  private async settleServiceRequest(cardId: string): Promise<void> {
    const srId = cardId.slice(SERVICE_REQUEST_PREFIX.length + 1); // "service-request-<id>"
    if (!srId) return;
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl(`/service-requests/${srId}/create-payment-session`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const body = (await response.json()) as { checkoutUrl?: string };
        if (body?.checkoutUrl) {
          window.open(body.checkoutUrl, '_blank', 'noopener');
        }
      }
    } catch {
      /* réseau → la carte reste, l'opérateur pourra réessayer */
      return;
    }
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId: cardId, outcome: 'validated' });
  }

  /**
   * Applique l'action d'une suggestion actionnable côté serveur. En cas d'échec
   * réseau/serveur, la carte reste (l'opérateur pourra réessayer) — pas de retrait
   * optimiste (l'action a un effet métier réel, on ne fait pas « comme si »).
   */
  private async applySuggestion(id: string): Promise<void> {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl(`/ai/supervision/suggestions/${id}/apply`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) return; // 400/409 → la carte reste
    } catch {
      return; // réseau → la carte reste, réessai possible
    }
    this.applicableSuggestionIds.delete(id);
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId: id, outcome: 'validated' });
  }

  /** Rejette une suggestion côté serveur (best-effort) + retire de la file. */
  private async dismissSuggestion(id: string, outcome: 'validated' | 'edited'): Promise<void> {
    try {
      const token = getAccessToken();
      await fetch(buildApiUrl(`/ai/supervision/suggestions/${id}/dismiss`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch {
      /* réseau → on retire quand même de la file localement */
    }
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId: id, outcome });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Démarrage d'un run uniquement si un kickoff est fourni (sinon : observation
    // passive — le run viendra du chat opérateur, fusion 4d).
    if (!this.runStarted && this.options.kickoffMessage) {
      this.runStarted = true;
      this.threadMessages = [{ role: 'user', content: this.options.kickoffMessage }];
      void this.startRun();
    }
    return () => this.listeners.delete(listener);
  }

  private emit(event: StreamEvent): void {
    [...this.listeners].forEach((l) => l(event));
  }

  /**
   * Déclenche un run depuis un message opérateur (chemin live 4d). On affiche
   * immédiatement le tour opérateur, on annule un éventuel run précédent (un
   * seul run actif à la fois), puis on ouvre le flux. La constellation réagit
   * via les STATE_SNAPSHOT, et la réponse texte est restituée via conversation.
   */
  async kickoff(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed || this.disposed) return;
    // Annule un run en cours : un seul échange à la fois (évite l'entrelacement
    // de deux flux SSE sur le même thread).
    this.abort?.abort();
    // Nouveau tour utilisateur → fil neuf : on repart d'un contexte propre
    // (toute action en attente d'un tour précédent est abandonnée).
    this.threadMessages = [{ role: 'user', content: trimmed }];
    this.lastOperatorMessage = trimmed; // B7 : historisé avec la réponse en fin de run
    this.currentRunId = null;
    if (this.currentInterruptId) {
      this.currentInterruptId = null;
      this.emit({ type: 'pendingAction.cleared' });
    }
    this.emit({
      type: 'conversation.message',
      turn: {
        id: `op-${Date.now()}`,
        role: 'operator',
        text: trimmed,
        at: new Date().toISOString(),
      },
    });
    await this.startRun();
  }

  /**
   * Reprend un run mis en pause par un interrupt (approbation inline). On renvoie
   * le contexte du fil (threadId/runId/messages, comme un run normal) PLUS un
   * tableau `resume` à la RACINE du body : status resolved/cancelled +
   * payload.confirmed. Le backend mappe ça sur resumeAfterConfirmation, ré-exécute
   * (ou abandonne) l'outil, et ré-ouvre le flux SSE.
   */
  async resolvePendingAction(confirmed: boolean): Promise<void> {
    if (this.disposed) return;
    const interruptId = this.currentInterruptId;
    if (!interruptId) return; // aucune action en attente → no-op gracieux
    this.currentInterruptId = null;
    this.abort?.abort();
    // La carte disparaît dès que la décision est prise (le run reprend).
    this.emit({ type: 'pendingAction.cleared' });
    const resume: ResumePayload[] = [
      {
        interruptId,
        status: confirmed ? 'resolved' : 'cancelled',
        payload: { confirmed },
      },
    ];
    await this.startRun(resume);
  }

  /**
   * Ouvre le flux AG-UI et traduit chaque STATE_SNAPSHOT.agentActivity en
   * StreamEvents constellation, + les TEXT_MESSAGE_* en réponse conversation.
   * Perte de flux → event `connection:false` (le hook tentera une reconnexion).
   */
  private async startRun(resume?: ResumePayload[]): Promise<void> {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.currentReplyId = null;
    this.runActive = true; // suspend le polling tant que le flux live pilote l'état
    this.emit({ type: 'conversation.busy', busy: true });
    const token = getAccessToken();
    try {
      const response = await fetch(buildApiUrl('/agui/run'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(this.buildRunInput(resume)),
        signal,
      });

      if (!response.ok || !response.body) {
        if (!this.disposed) this.emit({ type: 'connection', online: false });
        return;
      }

      await this.consumeSse(response.body.getReader());
    } catch {
      // Abort volontaire (nouveau kickoff) → silencieux ; vraie panne → hors-ligne.
      if (!this.disposed && !signal.aborted) this.emit({ type: 'connection', online: false });
    } finally {
      this.runActive = false; // le flux est terminé → le polling peut reprendre
      if (!this.disposed && !signal.aborted) this.emit({ type: 'conversation.busy', busy: false });
    }
  }

  /** Arme le timer de rafraîchissement périodique (idempotent, une seule fois). */
  private ensurePolling(): void {
    if (this.pollTimer || this.disposed) return;
    this.pollTimer = setInterval(() => {
      void this.pollRefresh();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Re-fetch le snapshot réel (feed + file HITL + suggestions) et émet
   * `snapshot.refreshed` pour faire apparaître les nouveaux événements sans reload.
   * No-op pendant un run live (le flux SSE pilote l'état) ou si un poll est déjà en vol.
   * `getSnapshot` est gracieux (jamais d'exception) et rafraîchit au passage la table
   * des suggestions actionnables (applicableSuggestionIds).
   */
  private async pollRefresh(): Promise<void> {
    if (this.disposed || this.runActive || this.polling) return;
    this.polling = true;
    try {
      const next = await this.getSnapshot();
      if (!this.disposed && !this.runActive) {
        this.emit({ type: 'snapshot.refreshed', snapshot: next });
      }
    } catch {
      // getSnapshot est déjà tolérant aux pannes ; on ignore tout résidu.
    } finally {
      this.polling = false;
    }
  }

  /**
   * RunAgentInput (cf. AgUiController.run : messages + forwardedProps). Pour une
   * reprise, on ajoute `resume` à la RACINE du body (contrat backend) tout en
   * conservant threadId/runId/messages comme un run normal.
   */
  private buildRunInput(resume?: ResumePayload[]): Record<string, unknown> {
    const forwardedProps: Record<string, unknown> = {};
    if (this.options.currentPage) forwardedProps.currentPage = this.options.currentPage;
    if (this.options.selectedPropertyId != null) {
      forwardedProps.selectedPropertyId = this.options.selectedPropertyId;
    }
    const input: Record<string, unknown> = {
      threadId: `supervision-${this.propertyId}`,
      messages: this.threadMessages,
      forwardedProps,
    };
    if (this.currentRunId) input.runId = this.currentRunId;
    if (resume && resume.length > 0) input.resume = resume;
    return input;
  }

  private async consumeSse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let data = '';
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (data) this.handleAgUiFrame(data);
      }
    }
  }

  /**
   * Parse un frame AG-UI. Familles d'intérêt :
   *   - RUN_STARTED                           → mémorise le runId (resume)
   *   - STATE_SNAPSHOT.snapshot.agentActivity → constellation (think/act/done)
   *   - TEXT_MESSAGE_CONTENT.delta            → réponse texte de l'orchestrateur
   *   - RUN_FINISHED.outcome=interrupt        → action sensible à valider (HITL)
   * Tout le reste (tool calls) est ignoré ici (forward-compatible).
   */
  private handleAgUiFrame(data: string): void {
    if (this.disposed) return;
    let frame: {
      type?: string;
      runId?: string;
      snapshot?: { agentActivity?: AgentActivityPayload };
      delta?: string;
      outcome?: { type?: string; interrupts?: AgUiInterrupt[] };
    };
    try {
      frame = JSON.parse(data);
    } catch {
      return; // frame illisible : ignoré (forward-compatible)
    }
    switch (frame.type) {
      case 'RUN_STARTED':
        if (typeof frame.runId === 'string') this.currentRunId = frame.runId;
        return;
      case 'RUN_FINISHED':
        if (frame.outcome?.type === 'interrupt') {
          this.handleInterrupt(frame.outcome.interrupts);
        } else {
          void this.persistConversation(); // B7 : historise l'échange (best-effort)
        }
        return;
      case 'STATE_SNAPSHOT': {
        const activity = frame.snapshot?.agentActivity;
        if (activity) this.translateActivity(activity);
        return;
      }
      case 'TEXT_MESSAGE_START':
        // Nouveau message assistant : on (ré)ouvre un tour orchestrateur.
        this.currentReplyId = `orch-${Date.now()}`;
        this.replyBuffer = '';
        return;
      case 'TEXT_MESSAGE_CONTENT': {
        if (typeof frame.delta !== 'string' || frame.delta.length === 0) return;
        // Repli : si aucun START reçu (selon le moteur), on crée le tour à la volée.
        if (!this.currentReplyId) this.currentReplyId = `orch-${Date.now()}`;
        this.replyBuffer += frame.delta;
        this.emit({ type: 'conversation.delta', id: this.currentReplyId, delta: frame.delta });
        return;
      }
      case 'TEXT_MESSAGE_END':
        // La réponse à la demande opérateur s'ajoute AUSSI au journal « En direct »,
        // sous forme d'entrée orchestrateur (en plus du fil de conversation).
        this.emitOrchestratorFeed(this.replyBuffer);
        this.replyBuffer = '';
        this.currentReplyId = null;
        return;
      default:
        return;
    }
  }

  /**
   * Ajoute la réponse de l'orchestrateur au journal « En direct » (entrée
   * orchestrateur, en plus du fil de conversation). Texte compacté sur une ligne
   * et borné pour rester lisible dans la carte.
   */
  private emitOrchestratorFeed(text: string): void {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const MAX = 140;
    const shown = clean.length > MAX ? `${clean.slice(0, MAX - 1)}…` : clean;
    this.emit({
      type: 'feed.added',
      entry: {
        id: `orch-feed-${Date.now()}`,
        agentId: 'com', // ignoré au rendu (orchestrator=true)
        at: new Date().toISOString(),
        text: shown,
        orchestrator: true,
      },
    });
  }

  /** agentActivity → StreamEvent(s) constellation (via mapping specialist→agent). */
  private translateActivity(activity: AgentActivityPayload): void {
    const agentId = mapSpecialistToAgent(activity.specialist);
    if (!agentId) return; // specialist technique masqué ou inconnu → rien.

    switch (activity.phase) {
      case 'started':
      case 'thinking':
        this.emit({
          type: 'agent.status',
          agentId,
          status: 'think',
          ...(activity.task ? { task: activity.task } : {}),
        });
        break;
      case 'acting': {
        // L'agent agit (un outil réel tourne). On l'affiche « agit » avec le
        // libellé de l'outil, et on enrichit le journal en direct. Pas de
        // comète ici : `agent.acting` exige une réservation cible, que le
        // moteur ne fournit pas (activité non rattachée à une résa).
        this.emit({
          type: 'agent.status',
          agentId,
          status: 'act',
          ...(activity.toolName ? { task: humanizeTool(activity.toolName) } : {}),
        });
        this.emit({
          type: 'feed.added',
          entry: {
            id: `agui-${agentId}-${Date.now()}`,
            agentId,
            at: new Date().toISOString(),
            text: activity.toolName
              ? `${agentLabel(agentId)} — ${humanizeTool(activity.toolName)}`
              : `${agentLabel(agentId)} agit`,
          },
        });
        break;
      }
      case 'done':
        this.emit({ type: 'agent.status', agentId, status: 'veille' });
        break;
      default:
        break; // phase inconnue : ignorée
    }
  }

  /**
   * Le run s'est mis en PAUSE sur une action sensible (interrupt). On retient
   * l'id à reprendre et on pose une action en attente dans le state superviseur
   * → le panneau affiche la carte Valider / Refuser. On ne traite que le 1er
   * interrupt (le moteur en émet un à la fois pour une confirmation d'outil).
   */
  private handleInterrupt(interrupts?: AgUiInterrupt[]): void {
    const interrupt = interrupts?.[0];
    if (!interrupt?.id) return;
    this.currentInterruptId = interrupt.id;
    this.emit({ type: 'pendingAction.added', action: toPendingAgentAction(interrupt) });
  }

  // ── Écritures (actions opérateur) ─────────────────────────────────────────
  // Le HITL inline passe par `resolvePendingAction` (resume AG-UI ci-dessus).
  // La file persistante « Attend ta validation » (PendingAction) = suggestions
  // org-scopées : valider/modifier les REJETTE côté serveur (informationnelles).
  // L'autonomie globale / pause restent pilotées depuis Settings > IA (no-op ici).

  // Routage par type de carte (préfixe d'id) :
  //  - « service-request-… » : « Régler » = ouvre le paiement Stripe de la SR, « Plus tard » = masque ;
  //  - « payout-reminder-… » : « Info reçue » = ack, « Ne plus afficher » = opt-out ;
  //  - sinon (suggestion de scan) : validate/edit = dismiss.

  async validatePending(actionId: string): Promise<void> {
    if (actionId.startsWith(SERVICE_REQUEST_PREFIX)) {
      await this.settleServiceRequest(actionId);
      return;
    }
    if (actionId.startsWith(PAYOUT_REMINDER_PREFIX)) {
      await this.postReminderAction(actionId, 'ack');
      return;
    }
    // Suggestion actionnable → applique l'action serveur (au lieu de rejeter).
    if (this.applicableSuggestionIds.has(actionId)) {
      await this.applySuggestion(actionId);
      return;
    }
    await this.dismissSuggestion(actionId, 'validated');
  }

  async editPending(actionId: string): Promise<void> {
    if (actionId.startsWith(SERVICE_REQUEST_PREFIX)) {
      // « Plus tard » : masque la carte pour cette session (revient au prochain chargement
      // tant que la demande reste impayée). Aucun effet serveur.
      if (!this.disposed) this.emit({ type: 'pending.resolved', actionId, outcome: 'edited' });
      return;
    }
    if (actionId.startsWith(PAYOUT_REMINDER_PREFIX)) {
      await this.postReminderAction(actionId, 'opt-out');
      return;
    }
    await this.dismissSuggestion(actionId, 'edited');
  }

  async setGlobalAutonomy(level: AutonomyLevel): Promise<void> {
    await applyAutonomy('all', level);
    await this.pollRefresh(); // reflète la nouvelle autonomie dans le snapshot
  }

  async setAgentAutonomy(agentId: AgentId, level: AutonomyLevel): Promise<void> {
    await applyAutonomy(agentId, level);
    await this.pollRefresh();
  }

  async setPaused(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * B7 : persiste l'échange (message opérateur + réponse orchestrateur) pour l'historique
   * de la constellation. Best-effort — l'historique n'est pas critique, un échec est ignoré.
   */
  private async persistConversation(): Promise<void> {
    const operator = this.lastOperatorMessage.trim();
    const orchestrator = this.replyBuffer.trim();
    if (!operator && !orchestrator) return;
    const turns: Array<{ role: string; content: string }> = [];
    if (operator) turns.push({ role: 'operator', content: operator });
    if (orchestrator) turns.push({ role: 'orchestrator', content: orchestrator });
    this.lastOperatorMessage = ''; // évite un double post si un run repart sans nouveau message
    try {
      const token = getAccessToken();
      await fetch(buildApiUrl(`/ai/supervision/conversation/${this.propertyId}`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(turns),
      });
    } catch {
      // best-effort : l'historique n'est pas sur le chemin critique
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.abort?.abort();
    this.abort = null;
    this.currentInterruptId = null;
    this.currentRunId = null;
    this.listeners.clear();
  }
}

// ─── Mapping interrupt → action en attente (partagé) ──────────────────────────

/** Interrupt AG-UI → carte d'approbation inline (langage métier, sans jargon). */
function toPendingAgentAction(interrupt: AgUiInterrupt): PendingAgentAction {
  const toolName = interrupt.metadata?.toolName;
  return {
    interruptId: interrupt.id,
    toolName: toolName ? humanizeTool(toolName) : 'Action',
    message: interrupt.message ?? interrupt.reason ?? 'Cette action requiert votre validation.',
    ...(interrupt.metadata?.args ? { args: interrupt.metadata.args } : {}),
  };
}

/**
 * PendingActionDto (réhydratation REST) → carte d'approbation inline. `argsSummary`
 * est un résumé JSON éventuellement tronqué : on le re-parse au mieux, sinon on
 * l'ignore (l'affichage des args reste optionnel).
 */
function pendingDtoToAgentAction(dto: PendingActionDtoShape): PendingAgentAction {
  const args = parseArgsSummary(dto.argsSummary);
  return {
    interruptId: dto.toolCallId,
    toolName: dto.toolName ? humanizeTool(dto.toolName) : 'Action',
    message: dto.description ?? 'Cette action requiert votre validation.',
    ...(args ? { args } : {}),
  };
}

/** Re-parse best-effort du résumé d'arguments (peut être tronqué → null). */
function parseArgsSummary(raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null; // résumé tronqué (suffixe « … ») ou non-JSON → on n'affiche pas les args
  }
}

// ─── Libellés métier (pas de jargon LLM) ──────────────────────────────────────

const AGENT_LABELS: Record<string, string> = {
  com: 'Communication',
  rev: 'Revenue',
  ops: 'Opérations',
  fin: 'Finance',
  rep: 'Réputation',
};

function agentLabel(agentId: string): string {
  return AGENT_LABELS[agentId] ?? agentId;
}

/** snake_case d'outil → libellé lisible court (sans jargon technique). */
function humanizeTool(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
