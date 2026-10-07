import apiClient from '../apiClient';
export interface SupplierPurchase {
  id: number; property_id: number; property_name: string; supplier_name: string; invoice_reference: string; description: string;
  expense_date: string; amount_ttc: number; currency: string; mode: 'BAITLY' | 'EXTERNAL' | null;
  beneficiary_user_id: number | null; expense_id: number | null; expense_status: string | null;
  external_url: string | null; external_reference: string | null; external_received_on: string | null;
  invitation_expires_at: string | null;
}
export interface SupplierPurchaseRequest {
  requestId: string; propertyId: number; supplierName: string; supplierEmail: string; invoiceReference: string;
  description: string; expenseDate: string; amountHt: string; taxRate: string;
}
const root = '/finance/supplier-purchases';
const multipart = (request: unknown, key: string, file: File) => {
  const body = new FormData(); body.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' })); body.append(key, file); return body;
};
export const baitlySupplierPurchasesApi = {
  list: () => apiClient.get<SupplierPurchase[]>(root),
  create: (request: SupplierPurchaseRequest, invoice: File) => apiClient.upload<{ id: number }>(root, multipart(request, 'invoice', invoice)),
  invite: (id: number) => apiClient.post<{ path: string }>(`${root}/${id}/invitation`),
  prepareExpense: (id: number) => apiClient.post<{ expenseId: number }>(`${root}/${id}/expense`),
  chooseExternal: (id: number, url: string) => apiClient.post<void>(`${root}/${id}/external`, { url }),
  recordExternal: (id: number, reference: string, paidOn: string, amount: number, currency: string, receipt: File) =>
    apiClient.upload<void>(`${root}/${id}/external-receipt`, multipart({ reference, paidOn, amount, currency }, 'receipt', receipt)),
  document: (id: number, kind: 'invoice' | 'receipt') => apiClient.get<Blob>(`${root}/${id}/documents/${kind}`, { responseType: 'blob' }),
  accept: (token: string) => apiClient.post<{ supplierName: string; invoiceReference: string; amount: number; currency: string }>('/me/supplier-invitations/accept', { token }),
  register: (token: string, email: string, firstName: string, lastName: string) =>
    apiClient.post<{ status: string }>('/invitations/register?kind=supplier', { token, email, firstName, lastName }),
};
