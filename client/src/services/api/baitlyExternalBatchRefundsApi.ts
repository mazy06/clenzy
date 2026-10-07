import apiClient from '../apiClient';

export interface ExternalBatchRefund {
  reference: string;
  stripeReference: string;
  amount: number;
  currency: string;
  interventionId: number | null;
  assigned: boolean;
  confirmed: boolean;
  assignable: boolean;
  reviewRequired: boolean;
}
export const baitlyExternalBatchRefundsApi = {
  targets: (interventionId: number) => apiClient.get<Array<{ interventionId: number; label: string; remaining: number; currency: string }>>(
    `/payments/${interventionId}/external-batch-refunds/targets`),
  distribute: (interventionId: number, row: ExternalBatchRefund, reason: string, portions: Array<{ interventionId: number; amount: number }>) =>
    apiClient.post<ExternalBatchRefund>(`/payments/${interventionId}/external-batch-refunds/${encodeURIComponent(row.reference)}/distribution`,
      { amount: row.amount, currency: row.currency, reason, portions }),
  list: (interventionId: number) => apiClient.get<ExternalBatchRefund[]>(`/payments/${interventionId}/external-batch-refunds`),
  assign: (interventionId: number, row: ExternalBatchRefund, reason: string) => apiClient.post<ExternalBatchRefund>(
    `/payments/${interventionId}/external-batch-refunds/${encodeURIComponent(row.reference)}/assignment`,
    { amount: row.amount, currency: row.currency, reason }),
};
