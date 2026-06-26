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
import type { OrchestratorSnapshot, PendingAgentAction, StreamEvent } from '../types';
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

/** Interrupt remonté dans RUN_FINISHED.outcome (contrat backend HITL). */
interface AgUiInterrupt {
  id: string;
  reason?: string;
  message?: string;
  toolCallId?: string;
  metadata?: { toolName?: string; args?: Record<string, unknown> };
}

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

export class AgUiSupervisionProvider implements SupervisionProvider<OrchestratorSnapshot> {
  private readonly listeners = new Set<Listener>();
  private abort: AbortController | null = null;
  private disposed = false;
  private runStarted = false;
  /** id du tour orchestrateur en cours (un par run) → accumulation des deltas texte. */
  private currentReplyId: string | null = null;
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

  constructor(
    private readonly propertyId: string,
    private readonly options: AgUiProviderOptions = {},
  ) {}

  /**
   * Snapshot initial : on part d'une constellation « en direct » au repos
   * (5 agents en veille). L'état réel se construit ensuite par les StreamEvents
   * d'activité reçus du moteur. On réutilise le builder existant (scénario
   * `calm` → online:true, agents présents) puis on neutralise les statuts.
   */
  async getSnapshot(): Promise<OrchestratorSnapshot> {
    const base = buildPropertySnapshot(this.propertyId, 'calm');
    // Réhydratation gracieuse : si le backend expose une file d'actions en
    // attente (run mis en pause avant un reload), on la réaffiche. L'endpoint
    // peut ne pas exister encore → on ignore tout échec (404 / réseau).
    const pendingAction = await this.fetchPendingAction();
    return {
      ...base,
      online: true,
      paused: false,
      pending: [],
      feed: [],
      agents: base.agents.map((a) => ({ ...a, status: 'veille', reservationId: null })),
      summary: 'Connecté au moteur multi-agent · en attente d’activité',
      ...(pendingAction ? { pendingAction } : {}),
    };
  }

  /**
   * Réinterroge la file d'actions en attente au montage (GET /api/agui/pending).
   * GRACIEUX : tout échec (endpoint absent, réseau, parse) → null, jamais
   * d'erreur propagée. Mémorise l'interruptId pour permettre la reprise.
   */
  private async fetchPendingAction(): Promise<PendingAgentAction | null> {
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
      if (!response.ok) return null;
      const body = (await response.json()) as { interrupts?: AgUiInterrupt[] } | AgUiInterrupt[];
      const interrupts = Array.isArray(body) ? body : body.interrupts;
      const interrupt = interrupts?.[0];
      if (!interrupt?.id) return null;
      this.currentInterruptId = interrupt.id;
      return toPendingAgentAction(interrupt);
    } catch {
      return null; // endpoint pas encore en place / réseau → ignoré
    }
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
      if (!this.disposed && !signal.aborted) this.emit({ type: 'conversation.busy', busy: false });
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
        if (frame.outcome?.type === 'interrupt') this.handleInterrupt(frame.outcome.interrupts);
        return;
      case 'STATE_SNAPSHOT': {
        const activity = frame.snapshot?.agentActivity;
        if (activity) this.translateActivity(activity);
        return;
      }
      case 'TEXT_MESSAGE_START':
        // Nouveau message assistant : on (ré)ouvre un tour orchestrateur.
        this.currentReplyId = `orch-${Date.now()}`;
        return;
      case 'TEXT_MESSAGE_CONTENT': {
        if (typeof frame.delta !== 'string' || frame.delta.length === 0) return;
        // Repli : si aucun START reçu (selon le moteur), on crée le tour à la volée.
        if (!this.currentReplyId) this.currentReplyId = `orch-${Date.now()}`;
        this.emit({ type: 'conversation.delta', id: this.currentReplyId, delta: frame.delta });
        return;
      }
      case 'TEXT_MESSAGE_END':
        this.currentReplyId = null;
        return;
      default:
        return;
    }
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
  // La file persistante « Attend ta validation » (PendingAction) n'est pas
  // branchée sur ce provider : ces écritures restent des no-op structurels (la
  // constellation reste lisible). On NE simule RIEN (contrairement au mock).

  async validatePending(_actionId: string): Promise<void> {
    return Promise.resolve();
  }

  async editPending(_actionId: string): Promise<void> {
    return Promise.resolve();
  }

  async setGlobalAutonomy(): Promise<void> {
    return Promise.resolve();
  }

  async setAgentAutonomy(): Promise<void> {
    return Promise.resolve();
  }

  async setPaused(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
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
