/* ============================================================
   aggregatePortfolio — rollup des snapshots par logement

   La vue d'ensemble n'est PAS une 6ᵉ constellation serveur : c'est une
   agrégation des OrchestratorSnapshot de chaque logement (data-contract §6).
   Règles :
   - status du rollup  = statut le plus prioritaire sur le parc (wait > act > think > veille)
   - propertyCount     = nb de logements où l'agent n'est pas en veille → BADGE
   - pending           = concat de toutes les files, chacune taguée du logement
   - feed              = concat des journaux, tagué + trié chrono inversé
   Pur → testable.
   ============================================================ */

import { AGENT_IDS, DEFAULT_AUTONOMY, STATUS_PRIORITY, maxPriorityStatus } from '../constants';
import type {
  AgentStatus,
  OrchestratorSnapshot,
  PortfolioAgentItem,
  PortfolioAgentRollup,
  PortfolioFeedEntry,
  PortfolioPendingAction,
  PortfolioSnapshot,
} from '../types';

export function aggregatePortfolio(
  snapshots: OrchestratorSnapshot[],
  propertyNames: Record<string, string> = {},
): PortfolioSnapshot {
  const nameOf = (id: string) => propertyNames[id] ?? id;

  const agents: PortfolioAgentRollup[] = AGENT_IDS.map((agentId) => {
    const present = snapshots
      .map((snap) => ({ snap, agent: snap.agents.find((a) => a.id === agentId) }))
      .filter((x): x is { snap: OrchestratorSnapshot; agent: NonNullable<typeof x.agent> } => Boolean(x.agent));

    const items: PortfolioAgentItem[] = present
      .filter((x) => x.agent.status !== 'veille')
      .map((x) => ({
        propertyId: x.snap.propertyId,
        propertyName: nameOf(x.snap.propertyId),
        status: x.agent.status,
        task: x.agent.task ?? '',
      }));

    const status: AgentStatus = maxPriorityStatus(present.map((x) => x.agent.status));
    // tâche de synthèse = celle de l'item le plus prioritaire (contenu réel de l'agent)
    const lead = items.slice().sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status])[0];

    return {
      id: agentId,
      status,
      autonomy: present[0]?.agent.autonomy ?? DEFAULT_AUTONOMY,
      propertyCount: items.length,
      task: lead?.task ?? '',
      items,
    };
  });

  const pending: PortfolioPendingAction[] = snapshots.flatMap((snap) =>
    snap.pending.map((p) => ({ ...p, propertyId: snap.propertyId, propertyName: nameOf(snap.propertyId) })),
  );

  const feed: PortfolioFeedEntry[] = snapshots
    .flatMap((snap) => snap.feed.map((f) => ({ ...f, propertyName: nameOf(snap.propertyId) })))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    scope: 'portfolio',
    propertyCount: snapshots.length,
    online: snapshots.length > 0 && snapshots.every((s) => s.online),
    globalAutonomy: snapshots[0]?.globalAutonomy ?? DEFAULT_AUTONOMY,
    paused: snapshots.length > 0 && snapshots.every((s) => s.paused),
    agents,
    pending,
    feed,
    dayMetrics: {
      timeSaved: '',
      autoActions: snapshots.reduce((sum, s) => sum + s.dayMetrics.autoActions, 0),
      awaiting: pending.length,
    },
  };
}
