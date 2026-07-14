/* ============================================================
   MockSupervisionProvider — implémentation de démo de la seam

   Rejoue un snapshot + un flux scripté, pour développer tout le front
   sans le back. Implémente SupervisionProvider à l'identique de ce que
   fera l'adaptateur CopilotKit/AG-UI.

   Les timers sont traqués et libérés par dispose() → pas de fuite,
   et testable sous fake timers.
   ============================================================ */

import type {
  AgentId,
  AutonomyLevel,
  OrchestratorSnapshot,
  PortfolioSnapshot,
  StreamEvent,
} from '../types';
import type { SupervisionProvider } from './SupervisionProvider';
import {
  MOCK_RESERVATION_FAMILLE_ROUX,
  MOCK_RESERVATION_LEA_MARCHAND,
  buildPortfolioSnapshot,
  buildPropertySnapshot,
  type PropertyScenario,
} from './mockData';

type Listener = (event: StreamEvent) => void;

/** Plomberie commune : abonnés + timers traqués. */
class EventHub {
  private listeners = new Set<Listener>();
  private timeouts = new Set<ReturnType<typeof setTimeout>>();
  private intervals = new Set<ReturnType<typeof setInterval>>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: StreamEvent): void {
    // copie défensive : un listener peut se désabonner pendant l'émission
    [...this.listeners].forEach((l) => l(event));
  }

  after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
  }

  every(ms: number, fn: () => void): void {
    const id = setInterval(fn, ms);
    this.intervals.add(id);
  }

  dispose(): void {
    this.timeouts.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    this.timeouts.clear();
    this.intervals.clear();
    this.listeners.clear();
  }
}

export interface MockProviderOptions {
  /** Latence simulée du snapshot (le ciel « s'allume »). 0 → résolution synchrone (tests). */
  latencyMs?: number;
  /** Cible réelle de la comète (ex. id d'une réservation visible dans le planning). */
  cometReservationId?: string;
  /**
   * Ouvre le modal de fiche client (GuestCardDialog) pour une réservation. Appelé quand
   * l'opérateur valide une carte `guest_email_missing` : action 100 % front (mock : parité
   * avec le provider réel — aucun effet de résolution serveur).
   */
  onOpenGuestCard?: (reservationId: string) => void;
}

// ─── Provider par logement ───────────────────────────────────────────────────

export class MockSupervisionProvider implements SupervisionProvider<OrchestratorSnapshot> {
  private readonly hub = new EventHub();
  private scriptStarted = false;
  /** Cartes « email voyageur manquant » du snapshot courant → reservationId (parité live). */
  private readonly guestCardResId = new Map<string, string>();

  constructor(
    private readonly propertyId: string,
    private readonly options: MockProviderOptions = {},
    private readonly scenario: PropertyScenario = 'showcase',
  ) {}

  getSnapshot(): Promise<OrchestratorSnapshot> {
    const snapshot = buildPropertySnapshot(this.propertyId, this.scenario);
    // Carte « email voyageur manquant » : cible une réservation réelle du planning si
    // fournie (cometReservationId), sinon garde le placeholder du mock. On mémorise
    // l'association id→reservationId pour router « Valider » vers l'ouverture de la fiche.
    this.guestCardResId.clear();
    for (const p of snapshot.pending) {
      if (!p.opensGuestCard) continue;
      const resId = this.options.cometReservationId ?? p.reservationId ?? undefined;
      if (this.options.cometReservationId) p.reservationId = this.options.cometReservationId;
      if (resId) this.guestCardResId.set(p.id, resId);
    }
    // Latence simulée COURTE : elle mime un aller-retour réseau pour exercer le
    // skeleton, sans pénaliser l'ouverture de l'accordéon (600 ms auparavant —
    // ressenti « lent » pointé par l'audit perf).
    const latency = this.options.latencyMs ?? 120;
    if (latency <= 0) return Promise.resolve(snapshot);
    return new Promise((resolve) => this.hub.after(latency, () => resolve(snapshot)));
  }

  subscribe(listener: Listener): () => void {
    const unsubscribe = this.hub.subscribe(listener);
    this.startScript();
    return unsubscribe;
  }

  /** Flux scripté : un agent agit (comète), puis le journal s'incrémente « en direct ». */
  private startScript(): void {
    if (this.scriptStarted || this.scenario !== 'showcase') return;
    this.scriptStarted = true;

    // Communication agit sur une réservation → déclenche une comète (Phase 5).
    const cometTarget = this.options.cometReservationId ?? MOCK_RESERVATION_FAMILLE_ROUX;
    this.hub.after(1_100, () => {
      this.hub.emit({ type: 'agent.acting', agentId: 'com', reservationId: cometTarget });
    });

    // Battement « en direct » : le journal s'enrichit périodiquement.
    const beats: Array<{ agentId: AgentId; text: string }> = [
      { agentId: 'com', text: 'Communication suit une nouvelle conversation voyageur' },
      { agentId: 'ops', text: 'Opérations a confirmé un créneau prestataire' },
      { agentId: 'fin', text: 'Finance a rapproché un paiement Airbnb' },
    ];
    let beat = 0;
    this.hub.every(14_000, () => {
      const b = beats[beat % beats.length];
      beat += 1;
      this.hub.emit({
        type: 'feed.added',
        entry: { id: `f-live-${beat}`, at: new Date().toISOString(), agentId: b.agentId, text: b.text },
      });
    });
  }

  validatePending(actionId: string): Promise<void> {
    // Carte « email voyageur manquant » : ouvre la fiche client (front), pas de résolution.
    const guestCardResId = this.guestCardResId.get(actionId);
    if (guestCardResId) {
      this.options.onOpenGuestCard?.(guestCardResId);
      return Promise.resolve();
    }
    return this.resolvePending(actionId, 'validated');
  }

  editPending(actionId: string): Promise<void> {
    return this.resolvePending(actionId, 'edited');
  }

  private resolvePending(actionId: string, outcome: 'validated' | 'edited'): Promise<void> {
    this.hub.emit({ type: 'pending.resolved', actionId, outcome });
    // l'agent Revenue quitte la file et passe « agit »
    this.hub.emit({
      type: 'agent.status',
      agentId: 'rev',
      status: 'act',
      task: outcome === 'validated' ? 'Applique −12 % sur le 20–22 juil.' : "Ouvre l'éditeur de tarif (20–22 juil.)",
    });
    // agit sur la réservation concernée → déclenche la comète (Phase 5)
    if (outcome === 'validated') {
      this.hub.emit({
        type: 'agent.acting',
        agentId: 'rev',
        reservationId: this.options.cometReservationId ?? MOCK_RESERVATION_LEA_MARCHAND,
      });
    }
    this.hub.emit({
      type: 'feed.added',
      entry: {
        id: `f-resolve-${actionId}`,
        at: new Date().toISOString(),
        agentId: 'rev',
        text: outcome === 'validated' ? 'Revenue — action validée par toi et appliquée' : 'Revenue — action ouverte pour modification',
      },
    });
    return Promise.resolve();
  }

  // Écritures d'autonomie / pause : no-op structurel pour le mock (Phase 3 câblera les effets).
  setGlobalAutonomy(_level: AutonomyLevel): Promise<void> {
    return Promise.resolve();
  }

  setAgentAutonomy(_agentId: AgentId, _level: AutonomyLevel): Promise<void> {
    return Promise.resolve();
  }

  setPaused(_paused: boolean): Promise<void> {
    return Promise.resolve();
  }

  /** Dev/test : simule une perte/reprise de connexion (émet un event `connection`). */
  simulateConnection(online: boolean): void {
    this.hub.emit({ type: 'connection', online });
  }

  /** Dev/test : un AUTRE opérateur a traité l'action (concurrence multi-opérateur). */
  simulateResolvedByOther(actionId: string, by: string): void {
    this.hub.emit({ type: 'pending.resolved', actionId, outcome: 'validated', by });
  }

  /** Dev/test : une action expire côté serveur. */
  simulateExpired(actionId: string): void {
    this.hub.emit({ type: 'pending.resolved', actionId, outcome: 'expired' });
  }

  dispose(): void {
    this.hub.dispose();
    this.scriptStarted = false;
  }
}

// ─── Provider portefeuille ───────────────────────────────────────────────────

export class MockPortfolioProvider implements SupervisionProvider<PortfolioSnapshot> {
  private readonly hub = new EventHub();

  constructor(private readonly options: MockProviderOptions = {}) {}

  getSnapshot(): Promise<PortfolioSnapshot> {
    const snapshot = buildPortfolioSnapshot();
    const latency = this.options.latencyMs ?? 600;
    if (latency <= 0) return Promise.resolve(snapshot);
    return new Promise((resolve) => this.hub.after(latency, () => resolve(snapshot)));
  }

  subscribe(listener: Listener): () => void {
    return this.hub.subscribe(listener);
  }

  validatePending(actionId: string): Promise<void> {
    this.hub.emit({ type: 'pending.resolved', actionId, outcome: 'validated' });
    return Promise.resolve();
  }

  editPending(actionId: string): Promise<void> {
    this.hub.emit({ type: 'pending.resolved', actionId, outcome: 'edited' });
    return Promise.resolve();
  }

  setGlobalAutonomy(_level: AutonomyLevel): Promise<void> {
    return Promise.resolve();
  }

  setAgentAutonomy(_agentId: AgentId, _level: AutonomyLevel): Promise<void> {
    return Promise.resolve();
  }

  setPaused(_paused: boolean): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    this.hub.dispose();
  }
}
