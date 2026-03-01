import { apiClient, PaginatedResponse } from '../apiClient';

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

export interface CreatePaymentSessionRequest {
  interventionId: number;
  amount: number;
}

export interface PaymentSessionResponse {
  sessionId: string;
  url: string;
  interventionId: number;
}

export interface PaymentSessionStatus {
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  interventionStatus: string;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
  totalRefunded: number;
  transactionCount: number;
}

// ─── Payment Sheet (native mobile payments) ─────────────────────────────────

export interface PaymentSheetRequest {
  type: 'subscription' | 'intervention';
  forfait?: string;
  interventionId?: number;
  amount?: number;
}

export interface PaymentSheetResponse {
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
  publishableKey: string;
}

export interface StripeConfigResponse {
  publishableKey: string;
}

export const paymentsApi = {
  createSession(request: CreatePaymentSessionRequest) {
    return apiClient.post<PaymentSessionResponse>('/payments/create-session', request);
  },

  getSessionStatus(sessionId: string) {
    return apiClient.get<PaymentSessionStatus>(`/payments/session-status/${sessionId}`);
  },

  async getHistory(params?: Record<string, string>) {
    try {
      return await apiClient.get<PaginatedResponse<PaymentRecord>>('/payments/history', { params });
    } catch {
      // Fallback: compute from interventions
      try {
        const interventions = await apiClient.get<PaginatedResponse<any>>('/interventions', {
          params: { size: '200' },
        });
        const items = interventions.content ?? [];
        const records: PaymentRecord[] = items
          .filter((i: any) => i.estimatedCost && i.estimatedCost > 0)
          .map((i: any, idx: number) => ({
            id: idx + 1,
            interventionId: i.id,
            interventionTitle: i.title || `Intervention #${i.id}`,
            propertyName: i.propertyName || 'N/A',
            amount: i.estimatedCost || 0,
            currency: 'EUR',
            status:
              i.status === 'COMPLETED'
                ? ('PAID' as const)
                : i.status === 'AWAITING_PAYMENT'
                  ? ('PENDING' as const)
                  : i.status === 'CANCELLED'
                    ? ('CANCELLED' as const)
                    : ('PAID' as const),
            transactionDate: i.completedDate || i.scheduledDate || i.createdAt || new Date().toISOString(),
            createdAt: i.createdAt || new Date().toISOString(),
            hostName: i.requestorName || undefined,
            hostId: i.requestorId || undefined,
          }));

        return {
          content: records,
          totalElements: records.length,
          totalPages: 1,
        } as PaginatedResponse<PaymentRecord>;
      } catch {
        return { content: [], totalElements: 0, totalPages: 0 } as unknown as PaginatedResponse<PaymentRecord>;
      }
    }
  },

  // ─── Payment Sheet endpoints ──────────────────────────────────────────────

  createPaymentSheet(request: PaymentSheetRequest) {
    return apiClient.post<PaymentSheetResponse>('/mobile/payment-sheet', request);
  },

  getStripeConfig() {
    return apiClient.get<StripeConfigResponse>('/mobile/stripe-config');
  },

  async getSummary(): Promise<PaymentSummary> {
    try {
      return await apiClient.get<PaymentSummary>('/payments/summary');
    } catch {
      // Fallback: compute from history
      try {
        const history = await paymentsApi.getHistory({ size: '500' });
        const records = history.content ?? [];
        return {
          totalPaid: records.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.amount, 0),
          totalPending: records
            .filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING')
            .reduce((sum, r) => sum + r.amount, 0),
          totalRefunded: records.filter((r) => r.status === 'REFUNDED').reduce((sum, r) => sum + r.amount, 0),
          transactionCount: records.length,
        };
      } catch {
        return { totalPaid: 0, totalPending: 0, totalRefunded: 0, transactionCount: 0 };
      }
    }
  },
};
