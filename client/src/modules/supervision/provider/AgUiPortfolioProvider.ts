/* ============================================================
   AgUiPortfolioProvider — provider RÉEL de la vue portefeuille

   Agrège tous les logements de l'organisation via
   GET /api/ai/supervision/portfolio (une requête, agrégation serveur).
   Rafraîchissement périodique (30 s) → snapshot.refreshed. Valider/refuser
   une carte applique/rejette la suggestion sous-jacente.
   ============================================================ */

import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { applyAutonomy } from './supervisionConfigApi';
import type { SupervisionProvider } from './SupervisionProvider';
import type { AgentId, AutonomyLevel, PortfolioSnapshot, StreamEvent } from '../types';

type Listener = (event: StreamEvent) => void;

/** Rafraîchissement du portefeuille hors run (ms). */
const PORTFOLIO_POLL_MS = 30_000;

export class AgUiPortfolioProvider implements SupervisionProvider<PortfolioSnapshot> {
  private readonly listeners = new Set<Listener>();
  private disposed = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  /** ids des cartes ACTIONNABLES (applyActionType présent) → « Valider » = Appliquer. */
  private readonly applicableIds = new Set<string>();

  async getSnapshot(): Promise<PortfolioSnapshot> {
    const snap = await this.fetchSnapshot();
    this.indexApplicable(snap);
    this.ensurePolling();
    return snap;
  }

  private async fetchSnapshot(): Promise<PortfolioSnapshot> {
    const token = getAccessToken();
    const response = await fetch(buildApiUrl('/ai/supervision/portfolio'), {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error(`portfolio ${response.status}`);
    return (await response.json()) as PortfolioSnapshot;
  }

  private indexApplicable(snap: PortfolioSnapshot): void {
    this.applicableIds.clear();
    for (const card of snap.pending) {
      if (card.applyActionType) this.applicableIds.add(card.id);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensurePolling();
    return () => this.listeners.delete(listener);
  }

  private ensurePolling(): void {
    if (this.pollTimer || this.disposed) return;
    this.pollTimer = setInterval(() => {
      void this.pollRefresh();
    }, PORTFOLIO_POLL_MS);
  }

  private async pollRefresh(): Promise<void> {
    if (this.disposed || this.polling) return;
    this.polling = true;
    try {
      const snap = await this.fetchSnapshot();
      this.indexApplicable(snap);
      if (!this.disposed) this.emit({ type: 'snapshot.refreshed', snapshot: snap });
    } catch {
      // réseau/serveur indisponible → on garde l'état courant ; le prochain tick réessaie.
    } finally {
      this.polling = false;
    }
  }

  async validatePending(actionId: string): Promise<void> {
    // Carte actionnable → Appliquer (exécution serveur) ; sinon → rejet.
    const path = this.applicableIds.has(actionId)
      ? `/ai/supervision/suggestions/${actionId}/apply`
      : `/ai/supervision/suggestions/${actionId}/dismiss`;
    await this.post(path);
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId, outcome: 'validated' });
  }

  async editPending(actionId: string): Promise<void> {
    await this.post(`/ai/supervision/suggestions/${actionId}/dismiss`);
    if (!this.disposed) this.emit({ type: 'pending.resolved', actionId, outcome: 'edited' });
  }

  private async post(path: string): Promise<void> {
    const token = getAccessToken();
    await fetch(buildApiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }

  async setGlobalAutonomy(level: AutonomyLevel): Promise<void> {
    await applyAutonomy('all', level);
    await this.pollRefresh(); // reflète la nouvelle autonomie dans le snapshot
  }

  async setAgentAutonomy(agentId: AgentId, level: AutonomyLevel): Promise<void> {
    await applyAutonomy(agentId, level);
    await this.pollRefresh();
  }

  setPaused(): Promise<void> {
    return Promise.resolve();
  }

  private emit(event: StreamEvent): void {
    [...this.listeners].forEach((l) => l(event));
  }

  dispose(): void {
    this.disposed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.listeners.clear();
  }
}
