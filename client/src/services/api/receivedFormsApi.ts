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

export const receivedFormsApi = {
  _endpointAvailable: true,

  async list(params: { page?: number; size?: number; type?: string } = {}): Promise<ReceivedFormsPage> {
    if (!this._endpointAvailable) {
      return { content: [], totalElements: 0, totalPages: 0, number: 0, size: params.size ?? 20 };
    }
    try {
      return await apiClient.get<ReceivedFormsPage>('/admin/received-forms', { params });
    } catch {
      this._endpointAvailable = false;
      return { content: [], totalElements: 0, totalPages: 0, number: 0, size: params.size ?? 20 };
    }
  },

  async getById(id: number): Promise<ReceivedForm | null> {
    try {
      return await apiClient.get<ReceivedForm>(`/admin/received-forms/${id}`);
    } catch {
      return null;
    }
  },

  async updateStatus(id: number, status: string): Promise<ReceivedForm | null> {
    try {
      return await apiClient.put<ReceivedForm>(`/admin/received-forms/${id}/status`, undefined, {
        params: { status },
      });
    } catch {
      return null;
    }
  },

  async getStats(): Promise<ReceivedFormsStats> {
    if (!this._endpointAvailable) {
      return { totalNew: 0, totalRead: 0, totalProcessed: 0, totalArchived: 0, devisCount: 0, maintenanceCount: 0, supportCount: 0 };
    }
    try {
      return await apiClient.get<ReceivedFormsStats>('/admin/received-forms/stats');
    } catch {
      this._endpointAvailable = false;
      return { totalNew: 0, totalRead: 0, totalProcessed: 0, totalArchived: 0, devisCount: 0, maintenanceCount: 0, supportCount: 0 };
    }
  },

  resetAvailability() {
    this._endpointAvailable = true;
  },
};
