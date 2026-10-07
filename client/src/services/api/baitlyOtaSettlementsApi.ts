import apiClient from '../apiClient';

export interface OtaSettlement {
  id: number; ota_reference: string; bank_reference: string; beneficiary_name: string; currency: string;
  received_on: string; gross: number; fees: number; refunds: number; net: number; void_reason: string | null;
}
export interface OtaSettlementContext {
  total_price: number; currency: string; source: string; payment_collection: string;
  owner_id: number | null; owner_name: string | null; organization_name: string;
}
export interface OtaSettlementRequest {
  requestId: string; otaReference: string; bankReference: string; receivedOn: string; currency: string;
  beneficiaryUserId: number | null;
  lines: { reservationId: number; gross: string; fees: string; refunds: string; net: string }[];
}
const root = '/finance/ota-settlements';
export const baitlyOtaSettlementsApi = {
  list: (reservationId: number) => apiClient.get<OtaSettlement[]>(root, { params: { reservationId } }),
  context: (reservationId: number) => apiClient.get<OtaSettlementContext>(`${root}/context`, { params: { reservationId } }),
  candidates: (reservationId: number) => apiClient.get<{ id: number; total_price: number; property_name: string; owner_id: number | null; remaining: number }[]>(`${root}/candidates`, { params: { reservationId } }),
  record: (request: OtaSettlementRequest, statement: File, bankReceipt: File) => {
    const form = new FormData();
    form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    form.append('statement', statement); form.append('bankReceipt', bankReceipt);
    return apiClient.upload<{ id: number }>(root, form);
  },
  void: (id: number, reason: string) => apiClient.post<void>(`${root}/${id}/void`, { reason }),
  document: (id: number, kind: 'bank' | 'statement') => apiClient.get<Blob>(`${root}/${id}/documents/${kind}`, { responseType: 'blob' }),
};
