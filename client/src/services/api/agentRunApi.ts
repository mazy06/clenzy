import apiClient from '../apiClient';

/**
 * Grand Livre d'Autonomie (campagne X3) — replay d'un run d'agent.
 * Consomme GET /api/agui/history/{runId} (T-05). Chaque action IA a un « reçu »
 * rejouable : ses étapes (appels LLM, outils, délégations, pauses HITL).
 */

export interface AgentRunStep {
  seq: number;
  kind: 'LLM_CALL' | 'TOOL_CALL' | 'DELEGATION' | 'PAUSE' | 'SUMMARY';
  agent: string;
  toolName: string | null;
  detail: string | null;
  status: 'SUCCESS' | 'ERROR';
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  at: string;
}

export interface AgentRunReplay {
  runId: string;
  conversationId: number | null;
  origin: string;
  status: 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'ERROR';
  error: string | null;
  userQuery: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: AgentRunStep[];
}

export const agentRunApi = {
  getReplay: (runId: string): Promise<AgentRunReplay> =>
    apiClient.get<AgentRunReplay>(`/agui/history/${encodeURIComponent(runId)}`),

  // What-if replay (campagne L3) : le backend compose le prompt de re-analyse,
  // à envoyer ensuite par le chat normal (routage/crédits/HITL inchangés).
  whatIf: (runId: string, hypothesis: string): Promise<{ prompt: string }> =>
    apiClient.post<{ prompt: string }>(
      `/agui/history/${encodeURIComponent(runId)}/what-if`, { hypothesis }),
};
