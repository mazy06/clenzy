import apiClient from '../apiClient';

export interface ReceivedForm {
  id: number;
  formType: 'DEVIS' | 'MAINTENANCE' | 'SUPPORT';
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  subject: string;
  payload: string; // JSON string
  status: 'NEW' | 'READ' | 'PROCESSED' | 'ARCHIVED';
  ipAddress?: string;
  createdAt: string;
  readAt?: string;
  processedAt?: string;
}

export interface ReceivedFormsPage {
  content: ReceivedForm[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ReceivedFormsStats {
  totalNew: number;
  totalRead: number;
  totalProcessed: number;
  totalArchived: number;
  devisCount: number;
  maintenanceCount: number;
  supportCount: number;
}

/**
 * Service API pour les formulaires recus (DEVIS / MAINTENANCE / SUPPORT).
 *
 * Note : les erreurs sont propagees telles quelles (pas de catch silencieux).
 * React Query gere l'etat d'erreur via `error` dans useReceivedForms /
 * useFormsStats, et les composants doivent afficher un message d'erreur
 * approprie au lieu d'un tableau vide trompeur.
 */
export const receivedFormsApi = {
  async list(params: { page?: number; size?: number; type?: string } = {}): Promise<ReceivedFormsPage> {
    return apiClient.get<ReceivedFormsPage>('/admin/received-forms', { params });
  },

  async getById(id: number): Promise<ReceivedForm> {
    return apiClient.get<ReceivedForm>(`/admin/received-forms/${id}`);
  },

  async updateStatus(id: number, status: string): Promise<ReceivedForm> {
    return apiClient.put<ReceivedForm>(`/admin/received-forms/${id}/status`, undefined, {
      params: { status },
    });
  },

  async getStats(): Promise<ReceivedFormsStats> {
    return apiClient.get<ReceivedFormsStats>('/admin/received-forms/stats');
  },

  /**
   * @deprecated No-op conserve pour compat avec useResetFormsAvailability.
   * Le flag _endpointAvailable a ete retire (anti-pattern qui masquait les erreurs).
   */
  resetAvailability() {
    // intentionally empty
  },
};
