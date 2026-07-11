import apiClient from '../apiClient';

// ─── Anomalies terrain (Moteur Ménage 3C / P10) ──────────────────────────────
// Signalement terrain (housekeeper/technicien) → ticket qualifiable →
// conversion en demande de maintenance pré-chiffrée (ServiceRequest).

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'QUALIFIED' | 'CONVERTED' | 'DISMISSED';

export interface Issue {
  id: number;
  propertyId: number;
  propertyName: string | null;
  sourceInterventionId: number | null;
  reportedById: number | null;
  reportedByName: string | null;
  title: string;
  description: string | null;
  category: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  suggestedCost: number | null;
  convertedServiceRequestId: number | null;
  dismissReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateIssuePayload {
  propertyId?: number;
  sourceInterventionId?: number;
  title: string;
  description?: string;
  category?: string;
  severity?: IssueSeverity;
}

export interface QualifyIssuePayload {
  category?: string | null;
  severity?: IssueSeverity | null;
  suggestedCost?: number | null;
}

export const issuesApi = {
  list(params?: { status?: IssueStatus; propertyId?: number }): Promise<Issue[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.propertyId != null) query.set('propertyId', String(params.propertyId));
    const qs = query.toString();
    return apiClient.get<Issue[]>(`/issues${qs ? `?${qs}` : ''}`);
  },

  get(id: number): Promise<Issue> {
    return apiClient.get<Issue>(`/issues/${id}`);
  },

  create(payload: CreateIssuePayload): Promise<Issue> {
    return apiClient.post<Issue>('/issues', payload);
  },

  qualify(id: number, payload: QualifyIssuePayload): Promise<Issue> {
    return apiClient.put<Issue>(`/issues/${id}/qualify`, payload);
  },

  convert(id: number): Promise<Issue> {
    return apiClient.put<Issue>(`/issues/${id}/convert`, {});
  },

  dismiss(id: number, reason?: string): Promise<Issue> {
    return apiClient.put<Issue>(`/issues/${id}/dismiss`, { reason: reason || null });
  },
};
