import apiClient from '../apiClient';

export interface CommerceRefundView {
  reference: string; source: string; sourceId: number; currency: string; paid: number;
  refunded: number; reserved: number; available: number;
  refunds: { reference: string; status: string; amount: number; reason: string; applied: boolean }[];
}
export const baitlyCommerceApi = {
  restock: (id: number, proof: string) => apiClient.post<void>(`/shop/inventory/returns/${id}`, { proof }),
  payoutView: (source: string, sourceId: number) => apiClient.get<CommercePayoutView>(`/commerce/payouts?source=${encodeURIComponent(source)}&sourceId=${sourceId}`),
  cancelPayout: (id: number) => apiClient.post<void>(`/commerce/payouts/${id}/cancel`),
  payout: (body: { source: string; sourceId: number; party: string; requestId: string; amount: number; currency: string }) => apiClient.post<CommercePayoutView>('/commerce/payouts', body),
  operations: (source: string, sourceId: number) => apiClient.get<CommerceOperation[]>(source === 'HARDWARE_ORDER' ? `/shop/orders/${sourceId}/operations` : `/commerce/operations?source=${encodeURIComponent(source)}&sourceId=${sourceId}`),
  recordOperation: (body: { source: string; sourceId: number; requestId: string; action: string; proof: string; note: string }) => apiClient.post<CommerceOperation>('/commerce/operations', body),
  refundView: (source: string, sourceId: number, reference?: string) => apiClient.get<CommerceRefundView>(reference ? `/commerce/refunds?reference=${encodeURIComponent(reference)}` : `/commerce/refunds?source=${encodeURIComponent(source)}&sourceId=${sourceId}`),
  creditPurchases: () => apiClient.get<{ reference: string; amount: number; currency: string; label: string }[]>('/commerce/refunds/credit-purchases'),
  refund: (body: { reference: string; requestId: string; amount: number; reason: string }) => apiClient.post<CommerceRefundView>('/commerce/refunds', body),
};
export interface CommerceOperation { id: number; action: string; proof: string; note: string; createdAt: string }
export interface CommercePayoutView {
  currency: string; ownerAvailable: number; conciergeAvailable: number;
  transfers: { id: number; requestId: string; party: string; amount: number; state: string; reference: string | null; journalId: number | null }[];
  recoveries: { id: number; amount: number; state: string; reference: string | null; failure: string | null }[];
}
