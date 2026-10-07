import apiClient from '../apiClient';

export type TransferState = 'SUBMITTING' | 'TRANSFERRED' | 'RECONCILIATION_REQUIRED';
export type TransferSource = 'OWNER_PAYOUT' | 'INTERVENTION' | 'PROVIDER_EXPENSE';
export interface TransferRecovery {
  state: 'WAITING_REFUND' | 'RECOVERING' | 'RECOVERED' | 'NO_RECOVERY_REQUIRED' | 'REVIEW_REQUIRED' | 'CANCELLED';
  amount: number; currency: string; updatedAt: string; reversalReference?: string | null;
  /** Part financée par la commission, visible uniquement dans Finance. */
  commissionRefundAmount?: number;
}
export interface PayoutTransfer {
  id: number; source: TransferSource; sourceId: number;
  beneficiaryUserId: number | null; beneficiaryOrganizationId: number | null;
  amount: number; currency: string; provider: string; state: TransferState;
  externalReference: string | null; createdAt: string; updatedAt: string; description: string;
}
export interface TransferDetail {
  transfer: PayoutTransfer;
  beneficiaryName?: string | null;
  events: Array<{ state: TransferState; externalReference: string | null; createdAt: string; origin: string; actorSubject: string | null }>;
  bankPayouts: Array<{ payoutId: string; status: string; estimatedArrival: string | null; failureCode: string | null; eventCreated: string }>;
  recoveries?: TransferRecovery[];
}
export interface TransferPage { content: PayoutTransfer[]; totalElements: number; totalPages: number }
export interface TransferVerification { reference: string; destination: string; livemode: boolean; createdAt: string }
export interface TransferFilters { page: number; state: TransferState | ''; source: TransferSource | ''; search: string }
export type PayoutAlertCode = 'RECONCILIATION_REQUIRED' | 'TRANSFER_STALLED' | 'FUNDING_DISPUTED' | 'REFUND_RECOVERY_REQUIRED' | 'BANK_FAILED' | 'BANK_LATE' | 'BANK_UNCONFIRMED' | 'RECOVERY_FAILED' | 'RECOVERY_LATE';
export interface PayoutMonitoring {
  recoveryEnabled: boolean; providerConfigured: boolean;
  alerts: { content: Array<{ transferId: number; description: string; code: PayoutAlertCode }>; totalElements: number; totalPages: number };
}
const base = '/accounting/payout-transfers';
export const payoutTransfersApi = {
  monitoring: (page: number) => apiClient.get<PayoutMonitoring>(`${base}/monitoring?page=${page}`),
  list: ({ page, state, source, search }: TransferFilters) => {
    const query = new URLSearchParams({ page: String(page), size: '12', search });
    if (state) query.set('state', state);
    if (source) query.set('source', source);
    return apiClient.get<TransferPage>(`${base}?${query}`);
  },
  /** KPI totals cover every page of the same authorized filter. */
  listAll: async (filters: Omit<TransferFilters, 'page'>): Promise<PayoutTransfer[]> => {
    const records = new Map<number, PayoutTransfer>();
    for (let page = 0; page < 1000; page++) {
      const result = await payoutTransfersApi.list({ ...filters, page });
      result.content.forEach(record => records.set(record.id, record));
      if (page + 1 >= result.totalPages) return [...records.values()];
    }
    throw new Error('Trop de transferts pour calculer le total. Affinez les filtres.');
  },
  detail: (id: number) => apiClient.get<TransferDetail>(`${base}/${id}`),
  verify: (id: number, reference: string) => apiClient.post<TransferVerification>(`${base}/${id}/reconciliation/verify`, { reference }),
  confirm: (id: number, reference: string) => apiClient.post<PayoutTransfer>(`${base}/${id}/reconciliation/confirm`, { reference }),
};
