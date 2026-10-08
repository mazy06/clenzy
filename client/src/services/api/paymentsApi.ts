import apiClient from '../apiClient';
import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Existing Types ─────────────────────────────────────────────────────────

export interface PaymentSession {
  sessionId: string;
  url: string;
  clientSecret?: string;
}

export interface PaymentSessionStatus {
  paymentStatus: string;
  interventionStatus: string;
}

// ─── Payment History Types ──────────────────────────────────────────────────

export interface PaymentRecord {
  id: number;
  referenceId: number;        // ID de l'intervention ou de la reservation
  /**
   * Titre court de la ligne — ne contient PAS le nom de la propriete
   * (deja affiche dans la colonne PROPRIETE). Ex: "Menage Airbnb",
   * "Airbnb · 4 nuits", "Maintenance plomberie".
   */
  description: string;
  /**
   * Sous-titre facultatif rendu en caption sous la description principale.
   * Surtout utilise pour les reservations (plage de dates "10/05 → 15/05").
   * `null` ou absent → la 2e ligne n'est pas affichee.
   */
  subDescription?: string | null;
  propertyName: string;
  amount: number;
  payableAmount?: number;
  individualCheckout?: boolean;
  currency: string;
  status: 'UNKNOWN' | 'PARTIALLY_PAID' | 'NOT_REQUIRED' | 'PAID' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
  refundedAmount?: number;
  creditAppliedAmount?: number;
  refundPendingAmount?: number;
  refundReviewRequired?: boolean;
  paymentDisputed?: boolean;
  supportsPartialRefund?: boolean;
  refundAcrossReceipts?: boolean;
  type?: 'INTERVENTION' | 'RESERVATION' | 'SERVICE_REQUEST';
  paymentCollection?: 'PMS' | 'CHANNEL' | 'UNKNOWN';
  canCollect?: boolean;
  settlementStatus?: 'EXTERNAL_UNVERIFIED' | null;
  paymentMethod?: string;
  stripeSessionId?: string;
  transactionDate: string;
  createdAt: string;
  hostName?: string;
  hostId?: number;
  guestEmail?: string;         // Email du guest (reservations uniquement)
  // Backward-compat aliases from backend Jackson serialization
  interventionId?: number;
  interventionTitle?: string;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPaidByOta?: number;
  totalToVerify?: number;
  paidByOtaByCurrency?: Record<string, number>;
  toVerifyByCurrency?: Record<string, number>;
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
  createSession(data: {
    interventionId: number;
    amount: number;
    /** `DEPOSIT` = acompte du devis approuvé ; absent = prestation entière. */
    purpose?: 'DEPOSIT' | 'FULL';
    /** Écran d'où part le paiement — Stripe y revient, succès comme abandon. */
    returnUrl?: string;
  }) {
    return apiClient.post<PaymentSession>('/payments/create-session', data);
  },

  /** Règle plusieurs interventions en une session — le serveur recalcule le total. */
  createBatchSession(data: {
    interventionIds: number[];
    totalAmount: number;
    returnUrl?: string;
  }) {
    return apiClient.post<PaymentSession>('/payments/create-batch-session', data);
  },

  /** Cree une session Stripe en mode embedded (inline dans l'interface) */
  createEmbeddedSession(data: { interventionId: number; amount: number }) {
    return apiClient.post<PaymentSession>('/payments/create-embedded-session', data);
  },

  getSessionStatus(sessionId: string) {
    return apiClient.get<PaymentSessionStatus>(`/payments/session-status/${sessionId}`);
  },

  async getHistory(params?: PaymentHistoryParams): Promise<PaymentHistoryResponse> {
    return apiClient.get<PaymentHistoryResponse>('/payments/history', { params: params as Record<string, string | number | boolean | undefined | null> });
  },

  async getSummary(): Promise<PaymentSummary> {
    return apiClient.get<PaymentSummary>('/payments/summary');
  },

  /** Toutes les pages du filtre, jamais seulement les dix lignes visibles. */
  async getAllHistory(params?: Omit<PaymentHistoryParams, 'page' | 'size'>): Promise<PaymentRecord[]> {
    const records = new Map<string, PaymentRecord>();
    for (let page = 0; page < 1000; page++) {
      const response = await paymentsApi.getHistory({ ...params, page, size: 100 });
      response.content.forEach(item => records.set(`${item.type}:${item.referenceId}`, item));
      if (page + 1 >= response.totalPages) return [...records.values()];
    }
    throw new Error('La liste est trop volumineuse. Affinez les filtres avant de sélectionner les paiements.');
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

  async refund(interventionId: number): Promise<{ message: string; status?: 'PROCESSING' | 'COMPLETED' }> {
    return apiClient.post<{ message: string; status?: 'PROCESSING' | 'COMPLETED' }>(`/payments/${interventionId}/refund`);
  },

  refundInstallment(interventionId: number, amount: number, requestId: string) {
    return apiClient.post<{ message: string; status: 'PROCESSING' | 'COMPLETED'; refundReference: string }>(
      `/payments/${interventionId}/refund-installment`, { amount, requestId });
  },

  refundInstallmentStatus(reference: string) {
    return apiClient.get<{ status: string; reconciled: boolean }>(`/payments/refund-installment/${encodeURIComponent(reference)}`);
  },

  async downloadInvoice(id: number): Promise<Blob> {
    try {
      const token = getAccessToken();
      const response = await fetch(
        buildApiUrl(`/payments/${id}/invoice`),
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
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
