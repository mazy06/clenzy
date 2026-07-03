import apiClient from '../apiClient';

/**
 * Autonomie des agents (campagnes X2 + X4) — Règles de Confiance et
 * sous-budget d'autonomie premium. 1 crédit = 1000 millicredits.
 */

export interface TrustRule {
  id: number;
  toolName: string;
  status: 'SUGGESTED' | 'ACTIVE' | 'DISMISSED' | 'REVOKED';
  confirmationsSeen: number;
  suggestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface AutonomyBudget {
  premiumCapMillicredits: number;
  onCapBehavior: 'PAUSE' | 'NOTIFY_ONLY';
  /** JSON map {behaviorKey: boolean} — toggles des comportements premium. */
  behaviors: string;
  consumedMillicredits: number;
}

export interface AutonomyBudgetUpdate {
  premiumCapMillicredits: number;
  onCapBehavior: string;
  behaviors: string;
}

export const aiAutonomyApi = {
  getTrustRules: (): Promise<TrustRule[]> =>
    apiClient.get<TrustRule[]>('/ai/autonomy/trust-rules'),

  acceptTrustRule: (id: number): Promise<TrustRule> =>
    apiClient.post<TrustRule>(`/ai/autonomy/trust-rules/${id}/accept`, {}),

  dismissTrustRule: (id: number): Promise<TrustRule> =>
    apiClient.post<TrustRule>(`/ai/autonomy/trust-rules/${id}/dismiss`, {}),

  revokeTrustRule: (id: number): Promise<TrustRule> =>
    apiClient.post<TrustRule>(`/ai/autonomy/trust-rules/${id}/revoke`, {}),

  getBudget: (): Promise<AutonomyBudget> =>
    apiClient.get<AutonomyBudget>('/ai/autonomy/budget'),

  updateBudget: (body: AutonomyBudgetUpdate): Promise<AutonomyBudget> =>
    apiClient.put<AutonomyBudget>('/ai/autonomy/budget', body),
};
