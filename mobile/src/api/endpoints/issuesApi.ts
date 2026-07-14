import { apiClient } from '../apiClient';

// ─── Anomalies terrain (Moteur Ménage 3C / P10) ──────────────────────────────
// Un signalement terrain devient un ticket Issue côté backend, qualifiable par
// le gestionnaire puis convertible en demande de maintenance chiffrée.

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'QUALIFIED' | 'CONVERTED' | 'DISMISSED';

export interface Issue {
  id: number;
  propertyId: number;
  propertyName?: string;
  sourceInterventionId?: number;
  title: string;
  description?: string;
  category?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  suggestedCost?: number | null;
  convertedServiceRequestId?: number | null;
  createdAt?: string;
}

export interface CreateIssuePayload {
  /** Dérivé de l'intervention côté backend si sourceInterventionId est fourni. */
  propertyId?: number;
  sourceInterventionId?: number;
  title: string;
  description?: string;
  category?: string;
  severity?: IssueSeverity;
}

export const issuesApi = {
  create(payload: CreateIssuePayload) {
    return apiClient.post<Issue>('/issues', payload);
  },

  /** Mes signalements (suivi lecture seule — filtre reported_by côté serveur). */
  listMine() {
    return apiClient.get<Issue[]>('/issues', { params: { mine: true } });
  },
};
