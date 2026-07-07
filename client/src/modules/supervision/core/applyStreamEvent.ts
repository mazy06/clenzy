/* ============================================================
   applyStreamEvent — réducteur pur (snapshot, event) → snapshot

   Applique un événement temps réel au snapshot courant. Pur et
   immuable → testable, et indépendant du transport (mock aujourd'hui,
   CopilotKit/AG-UI demain). Préserve la portée (property | portfolio).
   ============================================================ */

import type {
  Agent,
  ConversationTurn,
  FeedEntry,
  OrchestratorSnapshot,
  PendingAction,
  PortfolioAgentRollup,
  PortfolioFeedEntry,
  PortfolioPendingAction,
  PortfolioSnapshot,
  StreamEvent,
  SupervisionSnapshot,
} from '../types';

const FEED_CAP = 40;
/** Garde-fou mémoire : on borne la conversation affichée (les anciens tours défilent). */
const CONVERSATION_CAP = 50;

/** Préprend/append un tour, ou met à jour un fragment streaming (même id → concat). */
function reduceConversation(
  prev: ConversationTurn[],
  evt: Extract<StreamEvent, { type: 'conversation.message' | 'conversation.delta' }>,
): ConversationTurn[] {
  if (evt.type === 'conversation.message') {
    return [...prev, evt.turn].slice(-CONVERSATION_CAP);
  }
  // conversation.delta : accumule sur le tour orchestrateur en cours (créé si absent).
  const idx = prev.findIndex((t) => t.id === evt.id);
  if (idx === -1) {
    const turn: ConversationTurn = { id: evt.id, role: 'orchestrator', text: evt.delta, at: new Date().toISOString() };
    return [...prev, turn].slice(-CONVERSATION_CAP);
  }
  const next = prev.slice();
  next[idx] = { ...next[idx], text: next[idx].text + evt.delta };
  return next;
}

function patchAgent(agent: Agent, evt: Extract<StreamEvent, { type: 'agent.status' | 'agent.acting' }>): Agent {
  if (evt.type === 'agent.acting') {
    return { ...agent, status: 'act', reservationId: evt.reservationId };
  }
  return {
    ...agent,
    status: evt.status,
    ...(evt.task !== undefined ? { task: evt.task } : {}),
    ...(evt.thinkingProgress !== undefined ? { thinkingProgress: evt.thinkingProgress } : {}),
    ...(evt.reservationId !== undefined ? { reservationId: evt.reservationId } : {}),
  };
}

function patchRollup(
  rollup: PortfolioAgentRollup,
  evt: Extract<StreamEvent, { type: 'agent.status' | 'agent.acting' }>,
): PortfolioAgentRollup {
  const status = evt.type === 'agent.acting' ? 'act' : evt.status;
  return {
    ...rollup,
    status,
    ...(evt.type === 'agent.status' && evt.task !== undefined ? { task: evt.task } : {}),
  };
}

function reduceProperty(snapshot: OrchestratorSnapshot, evt: StreamEvent): OrchestratorSnapshot {
  switch (evt.type) {
    case 'connection':
      return { ...snapshot, online: evt.online };
    case 'feed.added': {
      const entry: FeedEntry = { id: evt.entry.id, agentId: evt.entry.agentId, at: evt.entry.at, text: evt.entry.text };
      return { ...snapshot, feed: [entry, ...snapshot.feed].slice(0, FEED_CAP) };
    }
    case 'pending.added':
      return { ...snapshot, pending: [...snapshot.pending, evt.action as PendingAction] };
    case 'pending.resolved':
      return { ...snapshot, pending: snapshot.pending.filter((p) => p.id !== evt.actionId) };
    case 'agent.status':
    case 'agent.acting':
      return { ...snapshot, agents: snapshot.agents.map((a) => (a.id === evt.agentId ? patchAgent(a, evt) : a)) };
    case 'conversation.message':
    case 'conversation.delta':
      return { ...snapshot, conversation: reduceConversation(snapshot.conversation ?? [], evt) };
    case 'conversation.busy':
      return { ...snapshot, conversationBusy: evt.busy };
    case 'pendingAction.added':
      return { ...snapshot, pendingAction: evt.action };
    case 'pendingAction.cleared':
      return snapshot.pendingAction ? { ...snapshot, pendingAction: undefined } : snapshot;
    case 'snapshot.refreshed': {
      // Rafraîchissement périodique hors run : on remplace ce qui vient du serveur
      // (feed réel — toolName préservé —, file HITL, agents, métriques) mais on
      // CONSERVE l'état piloté par le flux live (conversation, busy, interrupt inline)
      // pour ne rien écraser en cours de session.
      const next = evt.snapshot;
      return {
        ...snapshot,
        online: next.online,
        paused: next.paused,
        summary: next.summary,
        agents: next.agents,
        pending: next.pending,
        feed: next.feed,
        dayMetrics: next.dayMetrics,
      };
    }
    default:
      return snapshot;
  }
}

function reducePortfolio(snapshot: PortfolioSnapshot, evt: StreamEvent): PortfolioSnapshot {
  switch (evt.type) {
    case 'connection':
      return { ...snapshot, online: evt.online };
    case 'feed.added': {
      const entry: PortfolioFeedEntry = {
        id: evt.entry.id,
        agentId: evt.entry.agentId,
        at: evt.entry.at,
        text: evt.entry.text,
        propertyName: 'propertyName' in evt.entry ? evt.entry.propertyName : '',
      };
      return { ...snapshot, feed: [entry, ...snapshot.feed].slice(0, FEED_CAP) };
    }
    case 'pending.added':
      return { ...snapshot, pending: [...snapshot.pending, evt.action as PortfolioPendingAction] };
    case 'pending.resolved':
      return { ...snapshot, pending: snapshot.pending.filter((p) => p.id !== evt.actionId) };
    case 'agent.status':
    case 'agent.acting':
      return { ...snapshot, agents: snapshot.agents.map((a) => (a.id === evt.agentId ? patchRollup(a, evt) : a)) };
    default:
      return snapshot;
  }
}

export function applyStreamEvent(snapshot: SupervisionSnapshot, evt: StreamEvent): SupervisionSnapshot {
  return snapshot.scope === 'portfolio' ? reducePortfolio(snapshot, evt) : reduceProperty(snapshot, evt);
}
