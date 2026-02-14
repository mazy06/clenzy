import apiClient from '../apiClient';

// ─── Existing Types ─────────────────────────────────────────────────────────

export interface PaymentSession {
  sessionId: string;
  url: string;
}

export interface PaymentSessionStatus {
  status: string;
  paymentStatus: string;
}

// ─── Payment History Types ──────────────────────────────────────────────────

export interface PaymentRecord {
  id: number;
  interventionId: number;
  interventionTitle: string;
  propertyName: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  paymentMethod?: string;
  stripeSessionId?: string;
  transactionDate: string;
  createdAt: string;
  hostName?: string;
  hostId?: number;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
  totalRefunded: number;
  transactionCount: number;
}

export interface PaymentHistoryResponse {
  content: PaymentRecord[];
  totalElements: number;
  totalPages: number;
}

export interface PaymentHistoryParams {
  page?: number;
  size?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  hostId?: number;
}

export interface HostOption {
  id: number;
  fullName: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const paymentsApi = {
  createSession(data: { interventionIds: number[]; totalAmount: number }) {
    return apiClient.post<PaymentSession>('/payments/create-session', data);
  },

  getSessionStatus(sessionId: string) {
    return apiClient.get<PaymentSessionStatus>(`/payments/session-status/${sessionId}`);
  },

  async getHistory(params?: PaymentHistoryParams): Promise<PaymentHistoryResponse> {
    try {
      return await apiClient.get<PaymentHistoryResponse>('/payments/history', { params: params as Record<string, string | number | boolean | undefined | null> });
    } catch {
      // Fallback: compute from interventions data
      try {
        const interventions = await apiClient.get<any>('/interventions?size=100');
        const items = interventions.content || interventions || [];
        const records: PaymentRecord[] = items
          .filter((i: any) => i.estimatedCost && i.estimatedCost > 0)
          .map((i: any, idx: number) => ({
            id: idx + 1,
            interventionId: i.id,
            interventionTitle: i.title || `Intervention #${i.id}`,
            propertyName: i.propertyName || 'N/A',
            amount: i.estimatedCost || 0,
            currency: 'EUR',
            status: i.status === 'COMPLETED' ? 'PAID' as const :
                    i.status === 'AWAITING_PAYMENT' ? 'PENDING' as const :
                    i.status === 'CANCELLED' ? 'REFUNDED' as const : 'PAID' as const,
            transactionDate: i.completedDate || i.scheduledDate || i.createdAt || new Date().toISOString(),
            createdAt: i.createdAt || new Date().toISOString(),
            hostName: i.requestorName || undefined,
            hostId: i.requestorId || undefined,
          }));

        // Apply filters if provided
        let filtered = records;
        if (params?.status) {
          filtered = filtered.filter(r => r.status === params.status);
        }
        if (params?.dateFrom) {
          filtered = filtered.filter(r => r.transactionDate >= params.dateFrom!);
        }
        if (params?.dateTo) {
          filtered = filtered.filter(r => r.transactionDate <= params.dateTo!);
        }

        // Apply pagination
        const page = params?.page || 0;
        const size = params?.size || 10;
        const start = page * size;
        const paged = filtered.slice(start, start + size);

        return {
          content: paged,
          totalElements: filtered.length,
          totalPages: Math.ceil(filtered.length / size),
        };
      } catch {
        return { content: [], totalElements: 0, totalPages: 0 };
      }
    }
  },

  async getSummary(): Promise<PaymentSummary> {
    try {
      return await apiClient.get<PaymentSummary>('/payments/summary');
    } catch {
      // Fallback: compute from history
      try {
        const history = await paymentsApi.getHistory({ size: 1000 });
        const records = history.content;
        return {
          totalPaid: records.filter(r => r.status === 'PAID').reduce((sum, r) => sum + r.amount, 0),
          totalPending: records.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + r.amount, 0),
          totalRefunded: records.filter(r => r.status === 'REFUNDED').reduce((sum, r) => sum + r.amount, 0),
          transactionCount: records.length,
        };
      } catch {
        return { totalPaid: 0, totalPending: 0, totalRefunded: 0, transactionCount: 0 };
      }
    }
  },

  async getById(id: number): Promise<PaymentRecord> {
    try {
      return await apiClient.get<PaymentRecord>(`/payments/${id}`);
    } catch {
      // Fallback: find in history
      const history = await paymentsApi.getHistory({ size: 1000 });
      const record = history.content.find(r => r.id === id);
      if (record) return record;
      throw new Error(`Payment record #${id} not found`);
    }
  },

  async getHosts(): Promise<HostOption[]> {
    try {
      return await apiClient.get<HostOption[]>('/payments/hosts');
    } catch {
      return [];
    }
  },

  async downloadInvoice(id: number): Promise<Blob> {
    try {
      const response = await fetch(
        `${window.location.origin}/api/v1/payments/${id}/invoice`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
        }
      );
      if (!response.ok) throw new Error('Invoice download failed');
      return await response.blob();
    } catch {
      // Fallback: return empty blob
      return new Blob(['Invoice not available'], { type: 'text/plain' });
    }
  },
};
