import apiClient from '../apiClient';

/** Demande RGPD (Réglages > Confidentialité, M9). */
export interface PrivacyRequest {
  id: number;
  guestId: number | null;
  requesterEmail: string;
  type: 'ERASURE' | 'ACCESS' | 'RECTIFICATION';
  status: 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REFUSED';
  requestedAt: string;
  dueAt: string;
  handledBy: string | null;
  notes: string | null;
  report: string | null;
}

export const privacyRequestsApi = {
  list(): Promise<PrivacyRequest[]> {
    return apiClient.get<PrivacyRequest[]>('/privacy-requests');
  },
  create(request: { guestId: number | null; requesterEmail: string; type: PrivacyRequest['type']; notes: string | null }): Promise<PrivacyRequest> {
    return apiClient.post<PrivacyRequest>('/privacy-requests', request);
  },
  /** IRRÉVERSIBLE : effacement sélectif (PII purgées, obligations légales conservées). */
  erase(id: number): Promise<PrivacyRequest> {
    return apiClient.post<PrivacyRequest>(`/privacy-requests/${id}/erase`, {});
  },
  refuse(id: number, reason?: string): Promise<void> {
    return apiClient.post<void>(`/privacy-requests/${id}/refuse`, reason ? { reason } : {});
  },
  complete(id: number): Promise<void> {
    return apiClient.post<void>(`/privacy-requests/${id}/complete`, {});
  },
};
