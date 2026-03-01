import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PayoutStatus = 'DRAFT' | 'APPROVED' | 'PAID';

export interface OwnerPayout {
  id: number;
  ownerId: number;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  commissionAmount: number;
  commissionRate: number;
  expenses: number;
  netAmount: number;
  status: PayoutStatus;
  paymentReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ChannelCommission {
  id?: number;
  channelName: string;
  commissionRate: number;
  organizationId?: number;
}

export const PAYOUT_STATUS_COLORS: Record<PayoutStatus, string> = {
  DRAFT: '#D4A574',
  APPROVED: '#1976d2',
  PAID: '#4A9B8E',
};

// ─── API ────────────────────────────────────────────────────────────────────

export const accountingApi = {
  async getPayouts(ownerId?: number, status?: PayoutStatus): Promise<OwnerPayout[]> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (ownerId) params.ownerId = ownerId;
    if (status) params.status = status;
    return apiClient.get<OwnerPayout[]>('/accounting/payouts', { params });
  },

  async getPayout(id: number): Promise<OwnerPayout> {
    return apiClient.get<OwnerPayout>(`/accounting/payouts/${id}`);
  },

  async generatePayout(ownerId: number, from: string, to: string): Promise<OwnerPayout> {
    return apiClient.post<OwnerPayout>('/accounting/payouts/generate', undefined, {
      params: { ownerId, from, to },
    });
  },

  async approvePayout(id: number): Promise<OwnerPayout> {
    return apiClient.put<OwnerPayout>(`/accounting/payouts/${id}/approve`);
  },

  async markAsPaid(id: number, paymentReference: string): Promise<OwnerPayout> {
    return apiClient.put<OwnerPayout>(`/accounting/payouts/${id}/pay`, undefined, {
      params: { paymentReference },
    });
  },

  async getCommissions(): Promise<ChannelCommission[]> {
    return apiClient.get<ChannelCommission[]>('/accounting/commissions');
  },

  async saveCommission(channel: string, data: ChannelCommission): Promise<ChannelCommission> {
    return apiClient.put<ChannelCommission>(`/accounting/commissions/${channel}`, data);
  },
};
